const hasMeta = (meta) => meta && Object.keys(meta).length > 0;

export const apiSuccess = (data = {}, message = "ok", meta = undefined) => {
  const payload = {
    success: true,
    data,
    message,
  };
  if (hasMeta(meta)) {
    payload.meta = meta;
  }
  return payload;
};

export const apiError = (error = "error", details = null, options = {}) => {
  const payload = {
    success: false,
    error,
  };
  if (details) {
    payload.details = details;
  }
  if (options.code) {
    payload.code = options.code;
  }
  if (options.status) {
    payload.status = options.status;
  }
  if (hasMeta(options.meta)) {
    payload.meta = options.meta;
  }
  return payload;
};

export const buildPaginationMeta = ({ page = 1, limit = 20, total = 0 } = {}) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const paginatedSuccess = ({ data = [], message = "ok", page = 1, limit = 20, total = 0, meta = {} } = {}) =>
  apiSuccess(data, message, { ...meta, ...buildPaginationMeta({ page, limit, total }) });
