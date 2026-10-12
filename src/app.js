'use strict';

const express = require('express');

const startedAt = new Date();
const version = process.env.APP_VERSION || 'dev';

// In-memory store keeps the demo dependency-free; swap for a DB in real use.
const todos = new Map();
let nextId = 1;

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    });
  });

  // Which slot/colour is serving? Handy for proving a blue-green swap worked.
  app.get('/version', (_req, res) => {
    res.json({ version, slot: process.env.SLOT_NAME || 'unknown' });
  });

  app.get('/api/todos', (_req, res) => {
    res.json([...todos.values()]);
  });

  app.post('/api/todos', (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    const todo = { id: nextId++, title, done: false };
    todos.set(todo.id, todo);
    return res.status(201).json(todo);
  });

  app.patch('/api/todos/:id', (req, res) => {
    const todo = todos.get(Number(req.params.id));
    if (!todo) {
      return res.status(404).json({ error: 'not found' });
    }
    if (typeof req.body?.done === 'boolean') {
      todo.done = req.body.done;
    }
    return res.json(todo);
  });

  app.delete('/api/todos/:id', (req, res) => {
    const deleted = todos.delete(Number(req.params.id));
    return deleted ? res.status(204).end() : res.status(404).json({ error: 'not found' });
  });

  return app;
}

function resetStore() {
  todos.clear();
  nextId = 1;
}

module.exports = { createApp, resetStore };
