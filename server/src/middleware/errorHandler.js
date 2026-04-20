function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.type === 'validation') {
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: 'Duplicate entry — record already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ success: false, error: 'Referenced record not found' });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, error: message });
}

module.exports = { errorHandler };
