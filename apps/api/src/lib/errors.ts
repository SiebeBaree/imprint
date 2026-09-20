export class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
export class NotFoundError extends HttpError {
    constructor(message = "This item could not be found.") {
        super(404, message);
    }
}
