import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { docsService } from './docs.service';

export async function registerDocsRoutes(server: FastifyInstance): Promise<void> {
  // Helper to determine if client wants raw Markdown
  const shouldReturnMarkdown = (req: FastifyRequest): boolean => {
    const acceptHeader = req.headers['accept'] || '';
    const userAgent = req.headers['user-agent'] || '';
    const formatQuery = (req.query as { format?: string }).format;

    return (
      formatQuery === 'md' ||
      formatQuery === 'markdown' ||
      acceptHeader.includes('text/markdown') ||
      acceptHeader.includes('text/x-markdown') ||
      userAgent.toLowerCase().includes('curl') ||
      userAgent.toLowerCase().includes('llm') ||
      userAgent.toLowerCase().includes('bot')
    );
  };

  // 1. AI Agent Standard Endpoint GET /llms.txt
  server.get('/llms.txt', async (_req: FastifyRequest, reply: FastifyReply) => {
    const markdown = docsService.getFullAggregatedMarkdown();
    return reply
      .header('content-type', 'text/markdown; charset=utf-8')
      .send(markdown);
  });

  // 2. Full Consolidated Endpoint GET /docs/all or GET /docs
  server.get('/docs', async (req: FastifyRequest, reply: FastifyReply) => {
    if (shouldReturnMarkdown(req)) {
      const markdown = docsService.getFullAggregatedMarkdown();
      return reply
        .header('content-type', 'text/markdown; charset=utf-8')
        .send(markdown);
    }

    return reply.send({
      status: 'ok',
      format: 'json',
      availableTopics: docsService.getAllTopicSummaries(),
      llmsEndpoint: '/llms.txt',
      fullMarkdownUrl: '/docs?format=md',
    });
  });

  // 3. Topic-Specific Endpoints GET /docs/:topic (e.g. /docs/overview, /docs/rooms, /docs/presence, /docs/events)
  server.get('/docs/:topic', async (req: FastifyRequest, reply: FastifyReply) => {
    const { topic } = req.params as { topic: string };

    if (topic === 'all') {
      const markdown = docsService.getFullAggregatedMarkdown();
      if (shouldReturnMarkdown(req)) {
        return reply
          .header('content-type', 'text/markdown; charset=utf-8')
          .send(markdown);
      }
      return reply.send({ status: 'ok', topic: 'all', content: markdown });
    }

    const doc = docsService.getTopic(topic);
    if (!doc) {
      const available = [...docsService.getAllTopicIds(), 'all'].join(', ');
      return reply.status(404).send({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Documentation topic '${topic}' not found. Available topics: ${available}.`,
      });
    }

    if (shouldReturnMarkdown(req)) {
      return reply
        .header('content-type', 'text/markdown; charset=utf-8')
        .send(doc.markdownContent);
    }

    return reply.send({
      status: 'ok',
      topic: doc.id,
      title: doc.title,
      summary: doc.summary,
      markdownContent: doc.markdownContent,
    });
  });
}
