import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const notificationSource = appSource.slice(
  appSource.indexOf('const newCommentsButton ='),
  appSource.indexOf("recentCommentsList.addEventListener('click'")
);
const markerKey = 'railnews:last-visit-comment-id';

function visit(storage = new Map()) {
  const button = { hidden: true };
  const handlers = {};
  const popover = {
    matches: () => false,
    addEventListener: (name, handler) => { handlers[name] = handler; }
  };
  const list = { innerHTML: '' };
  const context = vm.createContext({
    document: { querySelector: (selector) => ({
      '#newCommentsButton': button, '#recentComments': popover, '#recentCommentsList': list
    })[selector] },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    escapeHtml: (value) => String(value || ''),
    commentFaceLabel: () => 'Person',
    formatDateTime: () => 'Today'
  });
  vm.runInContext(notificationSource, context);
  return {
    button, list,
    render(ids) {
      context.comments = ids.map((id) => ({ id, comment_text: `Comment ${id}` }));
      vm.runInContext('renderRecentComments(comments)', context);
    },
    toggle(newState) { handlers.toggle({ newState }); }
  };
}

test('unopened comments remain unread after reloading', () => {
  const storage = new Map([[markerKey, '10']]);
  const first = visit(storage);
  first.render([12, 11]);
  assert.equal(first.button.hidden, false);
  assert.equal(storage.get(markerKey), '10');
  const reloaded = visit(storage);
  reloaded.render([12, 11]);
  assert.equal(reloaded.button.hidden, false);
  reloaded.toggle('closed');
  assert.equal(storage.get(markerKey), '10');
});

test('opening acknowledges comments immediately and retains the clickable preview', () => {
  const storage = new Map([[markerKey, '10']]);
  const current = visit(storage);
  current.render([12, 11]);
  current.toggle('open');
  assert.equal(current.button.hidden, true);
  assert.equal(storage.get(markerKey), '12');
  assert.match(current.list.innerHTML, /Comment 12/);
  current.render([12, 11]);
  assert.equal(current.button.hidden, true);
  current.render([13, 12]);
  assert.equal(current.button.hidden, false);
  assert.equal(storage.get(markerKey), '12');
  const reloaded = visit(storage);
  reloaded.render([]);
  assert.equal(reloaded.button.hidden, true);
  assert.equal(storage.get(markerKey), '12');
});

test('first visit establishes a baseline without showing historical comments', () => {
  const storage = new Map();
  const current = visit(storage);
  current.render([12, 11]);
  assert.equal(current.button.hidden, true);
  assert.equal(storage.get(markerKey), '12');
});

test('own comments stay excluded after reload without acknowledging other comments', () => {
  const storage = new Map([
    [markerKey, '10'], ['railnews:own-comment-ids', '[14,13,12]']
  ]);
  const current = visit(storage);
  current.render([15, 14, 13, 12, 11, 10]);
  assert.equal(current.button.hidden, false);
  assert.match(current.list.innerHTML, /Comment 15/);
  assert.match(current.list.innerHTML, /Comment 11/);
  assert.doesNotMatch(current.list.innerHTML, /Comment (14|13|12|10)/);
  assert.equal(storage.get(markerKey), '10');
  const reloaded = visit(storage);
  reloaded.render([14, 13, 12]);
  assert.equal(reloaded.button.hidden, true);
  assert.equal(storage.get(markerKey), '10');
});
