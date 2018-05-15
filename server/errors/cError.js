class cError extends Error {
  constructor(name, code, message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
    this.name = name;
    this.code = code;
    if (details) {
      this.details = details;
    }
    this.statusCode = statusCode || 500;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode
    }
  }
}

module.exports = cError;
