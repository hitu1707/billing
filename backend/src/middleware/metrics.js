import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'bill_tracker_'
});

export const httpRequestCounter = new client.Counter({
  name: 'bill_tracker_http_requests_total',
  help: 'Total HTTP requests by method, route, and status',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestCounter);

export const httpRequestDuration = new client.Histogram({
  name: 'bill_tracker_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 30]
});
register.registerMetric(httpRequestDuration);

export const billScanCounter = new client.Counter({
  name: 'bill_tracker_scans_total',
  help: 'Total bill scans by status',
  labelNames: ['status']
});
register.registerMetric(billScanCounter);

export const aiRequestCounter = new client.Counter({
  name: 'bill_tracker_ai_requests_total',
  help: 'AI extraction requests by provider and status',
  labelNames: ['provider', 'status']
});
register.registerMetric(aiRequestCounter);

export const aiExtractionDuration = new client.Histogram({
  name: 'bill_tracker_ai_extraction_duration_seconds',
  help: 'Time taken by AI to extract bill data',
  labelNames: ['provider'],
  buckets: [0.5, 1, 2, 5, 10, 20, 45]
});
register.registerMetric(aiExtractionDuration);

export const authEventCounter = new client.Counter({
  name: 'bill_tracker_auth_events_total',
  help: 'Authentication events by action, provider, and status',
  labelNames: ['action', 'provider', 'status']
});
register.registerMetric(authEventCounter);

export const activeSessionsGauge = new client.Gauge({
  name: 'bill_tracker_active_sessions',
  help: 'Number of currently active user sessions'
});
register.registerMetric(activeSessionsGauge);

export const cloudinaryUploadDuration = new client.Histogram({
  name: 'bill_tracker_cloudinary_upload_duration_seconds',
  help: 'Time taken to upload image to Cloudinary',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(cloudinaryUploadDuration);

export const metricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics') return next();

  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;

    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      durationInSeconds
    );
  });

  next();
};

export default register;
