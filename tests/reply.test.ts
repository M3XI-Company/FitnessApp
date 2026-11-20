import test from 'node:test'
import assert from 'node:assert/strict'
import { plainReply, replyBlocks } from '../src/lib/reply'

test('a reply is read into a title, paragraphs, steps and points', () => {
  const blocks = replyBlocks('# Lunch now\nEat the **chicken bowl**.\n\n## Later\n1. Warm up\n2. Squat\n- Drink water\n- Sleep early')
  assert.deepEqual(blocks.map((b) => b.kind), ['title', 'text', 'heading', 'list', 'list'])
  assert.deepEqual(blocks[3], { kind: 'list', ordered: true, items: ['Warm up', 'Squat'] })
  assert.deepEqual(blocks[4], { kind: 'list', ordered: false, items: ['Drink water', 'Sleep early'] })
})

test('only the first line can be the title, and each line is its own paragraph', () => {
  const blocks = replyBlocks('Do this.\n# Not a title\nThen that.')
  assert.deepEqual(blocks, [{ kind: 'text', text: 'Do this.' }, { kind: 'heading', text: 'Not a title' }, { kind: 'text', text: 'Then that.' }])
  assert.deepEqual(replyBlocks(''), [])
})

test('the plain reply keeps the words and drops the markup', () => {
  assert.equal(plainReply('# Plan\nEat **now**.\n- One\n- Two'), 'Plan\n\nEat now.\n\nOne\nTwo')
})
