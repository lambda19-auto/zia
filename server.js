import express from 'express';
import { buildPrompt, buildRecommendationSchema, agentInstructions } from './agent-prompts.js';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 8787);
const distPath = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}
if (!existsSync(join(distPath, 'index.html'))) {
    throw new Error('Missing dist/index.html. Run npm run build before starting the server.');
}
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const log = (level, message, context) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
    };
    if (level === 'error') {
        console.error(JSON.stringify(entry));
        return;
    }
    if (level === 'warn') {
        console.warn(JSON.stringify(entry));
        return;
    }
    console.log(JSON.stringify(entry));
};
app.use((req, res, next) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    log('info', 'Incoming request', {
        requestId,
        method: req.method,
        path: req.path,
    });
    res.on('finish', () => {
        log('info', 'Request completed', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
        });
    });
    next();
});
app.disable('x-powered-by');
app.use('/api', express.json({ limit: '16kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
const sendApiError = (res, status, error) => {
    return res.status(status).json({
        error,
    });
};
app.post('/api/recommendations', async (req, res) => {
    const requestId = String(res.locals.requestId || 'unknown');
    const body = req.body;
    if (!body || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 2000 ||
        (body.language !== undefined && !['ru', 'en'].includes(body.language)) ||
        (body.budget !== undefined && !['low', 'medium', 'high'].includes(body.budget)) ||
        (body.season !== undefined && !['winter', 'spring', 'summer', 'autumn'].includes(body.season)) ||
        (body.travelers !== undefined && (!Number.isInteger(body.travelers) || body.travelers < 1 || body.travelers > 50)) ||
        (body.hasChildren !== undefined && typeof body.hasChildren !== 'boolean')) {
        log('warn', 'Validation failed: invalid request', { requestId });
        return sendApiError(res, 400, 'Invalid trip parameters.');
    }
    if (!process.env.OPENAI_API_KEY) {
        log('error', 'Missing OPENAI_API_KEY', { requestId });
        return sendApiError(res, 503, 'Service is not configured.');
    }
    try {
        log('info', 'Calling OpenAI responses API', {
            requestId,
            budget: body.budget || 'medium',
            season: body.season || 'summer',
            travelers: Math.max(1, Number(body.travelers || 1)),
            hasChildren: Boolean(body.hasChildren),
        });
        const openaiStartedAt = Date.now();
        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            signal: AbortSignal.timeout(120000),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-5',
                tools: [{ type: 'web_search' }],
                instructions: agentInstructions(body.language),
                input: buildPrompt(body),
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'travel_recommendations',
                        strict: true,
                        schema: buildRecommendationSchema(body.language),
                    },
                },
            }),
        });
        if (!openaiResponse.ok) {
            log('error', 'OpenAI API request failed', {
                requestId,
                statusCode: openaiResponse.status,
                durationMs: Date.now() - openaiStartedAt,
            });
            return sendApiError(res, openaiResponse.status === 429 ? 429 : 502, 'Recommendations provider is unavailable.');
        }
        const data = (await openaiResponse.json());
        log('info', 'OpenAI API request succeeded', {
            requestId,
            statusCode: openaiResponse.status,
            durationMs: Date.now() - openaiStartedAt,
        });
        const outputTextItems = (data.output || [])
            .flatMap((item) => item.content || [])
            .filter((content) => content.type === 'output_text' && typeof content.text === 'string');
        const jsonText = outputTextItems
            .map((item) => item.text || '')
            .join('\n')
            .trim();
        if (!jsonText) {
            log('error', 'OpenAI returned empty output_text', { requestId });
            return sendApiError(res, 502, 'Recommendations provider returned an invalid response.');
        }
        const parsed = JSON.parse(jsonText);
        if (!parsed || !Array.isArray(parsed.recommendations)) {
            log('error', 'OpenAI returned invalid structured payload', { requestId });
            return sendApiError(res, 502, 'Recommendations provider returned an invalid response.');
        }
        const recommendations = parsed.recommendations.map((recommendation) => ({
            ...recommendation,
            sources: (recommendation.sources || [])
                .filter((source) => source && typeof source.url === 'string' && source.url.trim())
                .map((source) => ({
                title: source.title || source.url,
                url: source.url,
            }))
                .filter((source, index, array) => array.findIndex((item) => item.url === source.url) === index),
        }));
        log('info', 'Recommendations generated', {
            requestId,
            recommendationsCount: recommendations.length,
        });
        return res.json({ recommendations });
    }
    catch (error) {
        log('error', 'Recommendations API error', {
            requestId,
            error: error instanceof Error ? error.stack || error.message : String(error),
        });
        return sendApiError(res, 502, 'Recommendations provider is unavailable.');
    }
});
app.use('/api', (_req, res) => sendApiError(res, 404, 'API endpoint not found.'));
app.use(express.static(distPath, { index: false }));
app.get('*', (req, res) => {
    if (req.path.includes('.')) return res.sendStatus(404);
    return res.sendFile(join(distPath, 'index.html'));
});
app.use((error, _req, res, _next) => {
    log('warn', 'Invalid request body', { error: error.message });
    return sendApiError(res, error.status === 413 ? 413 : 400, 'Invalid JSON request body.');
});
app.listen(PORT, () => {
    log('info', `Server listening on port ${PORT}`);
});
