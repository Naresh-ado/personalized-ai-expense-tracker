import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Expense Tracker API',
      version: '1.0.0',
      description: 'Secure expense ingestion, analytics, budgets, and chat insights.'
    }
  },
  apis: ['./src/app.js']
};

export const specs = swaggerJSDoc(options);
