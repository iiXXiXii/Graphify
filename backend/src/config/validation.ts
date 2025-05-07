import * as Joi from 'joi';

export function validateConfig(config: Record<string, unknown>) {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().required(),
    GITHUB_CLIENT_ID: Joi.string().required(),
    GITHUB_CLIENT_SECRET: Joi.string().required(),
    GITHUB_CALLBACK_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRATION: Joi.string().default('24h'),
    FRONTEND_URL: Joi.string().uri().default('http://localhost:4200'),
    CORS_ORIGIN: Joi.string().uri().default('http://localhost:4200'),
  });

  const { error, value } = schema.validate(config, { allowUnknown: true });

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  return value;
}
