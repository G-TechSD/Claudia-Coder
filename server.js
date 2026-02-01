const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

// Default to production mode when serving the build
// Use NODE_ENV=development to enable dev mode with hot reloading
const dev = process.env.NODE_ENV === 'development';
const app = next({ dev });
const handle = app.getRequestHandler();

// SSL certificate paths from environment variables with sensible local defaults
// (keep env override for other machines)
const path = require('path');
const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'localhost.key');
const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'localhost.crt');

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

const PORT = parseInt(process.env.PORT || '1337', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(PORT, HOST, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${PORT}`);
  });
});
