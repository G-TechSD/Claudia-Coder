const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// SSL certificate paths from environment variables with fallback
const sslKeyPath = process.env.SSL_KEY_PATH || '/home/bill/certs/bill-dev-linux-1.key';
const sslCertPath = process.env.SSL_CERT_PATH || '/home/bill/certs/bill-dev-linux-1.crt';

// Check if SSL files exist before loading
if (!fs.existsSync(sslKeyPath)) {
  console.error(`SSL key file not found: ${sslKeyPath}`);
  process.exit(1);
}
if (!fs.existsSync(sslCertPath)) {
  console.error(`SSL cert file not found: ${sslCertPath}`);
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(sslKeyPath),
  cert: fs.readFileSync(sslCertPath)
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
