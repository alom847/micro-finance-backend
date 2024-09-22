import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    console.log(exception);

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = Object(exception.getResponse());
      message = response.message
        ? Array.isArray(response.message)
          ? response.message[0]
          : response.message
        : exception.message;
    }

    response.status(200).json({
      status: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
