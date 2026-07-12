/** Thrown by guards and domain logic; converted to a JSON response by `api()`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
