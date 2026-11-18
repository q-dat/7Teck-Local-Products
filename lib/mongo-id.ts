export const isMongoObjectIdString = (value: unknown): value is string =>
  typeof value === "string" && /^[\da-f]{24}$/iu.test(value);
