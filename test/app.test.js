'use strict';

const request = require('supertest');
const { createApp, resetStore } = require('../src/app');

describe('todo-service', () => {
  let app;

  beforeEach(() => {
    resetStore();
    app = createApp();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /version reports version and slot', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('slot');
  });

  test('creates and lists todos', async () => {
    const created = await request(app).post('/api/todos').send({ title: 'Ship it' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 1, title: 'Ship it', done: false });

    const list = await request(app).get('/api/todos');
    expect(list.body).toHaveLength(1);
  });

  test('rejects a todo without a title', async () => {
    const res = await request(app).post('/api/todos').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('marks a todo done', async () => {
    await request(app).post('/api/todos').send({ title: 'Write tests' });
    const res = await request(app).patch('/api/todos/1').send({ done: true });
    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);
  });

  test('deletes a todo and 404s on a missing one', async () => {
    await request(app).post('/api/todos').send({ title: 'Temp' });
    expect((await request(app).delete('/api/todos/1')).status).toBe(204);
    expect((await request(app).delete('/api/todos/1')).status).toBe(404);
  });
});
