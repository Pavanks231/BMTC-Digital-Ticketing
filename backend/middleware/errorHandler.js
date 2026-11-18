export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'The requested API endpoint was not found.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  res.status(500).json({ message: 'The server could not complete the request.' });
}
