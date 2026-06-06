export type PageRequest = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PageResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

export function normalizePageRequest(request: PageRequest) {
  const page = Number.isInteger(request.page) && (request.page ?? 0) > 0
    ? request.page!
    : 1;
  const requestedLimit = Number.isInteger(request.limit) ? request.limit! : 20;
  const limit = Math.min(100, Math.max(10, requestedLimit));
  const search = request.search?.trim() || undefined;

  return {
    page,
    limit,
    search,
    from: (page - 1) * limit,
    to: page * limit - 1,
  };
}

export function createPageResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PageResult<T> {
  return {
    data,
    page,
    limit,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  };
}

export function singleSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePositiveInteger(
  value: string | string[] | undefined
): number | undefined {
  const parsed = Number(singleSearchParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function escapePostgrestSearch(value: string) {
  return value
    .replace(/[(),]/g, " ")
    .replace(/[%_]/g, (character) => `\\${character}`);
}
