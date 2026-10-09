const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function makeElement(id = '') {
  return {
    id,
    children: [],
    textContent: '',
    innerHTML: '',
    hidden: false,
    className: '',
    disabled: false,
    style: {},
    attributes: {},
    listeners: {},
    classList: {
      add() {},
      remove() {}
    },
    lastElementChild: { textContent: '', classList: { add() {}, remove() {} }, setAttribute() {} },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(eventName, handler) {
      this.listeners[eventName] = handler;
    },
    querySelectorAll() {
      return this.children;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {},
    get value() {
      return this.textContent;
    },
    set value(value) {
      this.textContent = value;
    }
  };
}

function loadQuizApp() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptMatch = source.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(scriptMatch, 'Expected a script tag in index.html');

  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, makeElement(id));
    }
    return elements.get(id);
  };

  const progressBar = makeElement('progress-bar');
  const answersEl = makeElement('answers');
  const answerButtons = [makeElement('answer-0'), makeElement('answer-1'), makeElement('answer-2'), makeElement('answer-3')];
  answersEl.querySelectorAll = () => answerButtons;

  const documentMock = {
    getElementById(id) {
      if (id === 'answers') return answersEl;
      return getElement(id);
    },
    querySelector(selector) {
      if (selector === '[role="progressbar"]') return progressBar;
      return null;
    },
    createElement(tagName) {
      const element = makeElement(tagName);
      element.lastElementChild = { textContent: '', classList: { add() {}, remove() {} }, setAttribute() {} };
      return element;
    }
  };

  const context = {
    document: documentMock,
    console,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    JSON
  };

  const wrapped = `(function () {${scriptMatch[1]}; return { questions, shuffleQuestions, roundQuestions, selectedAnswers, getMissedQuestions, startNewRound }; })();`;
  return vm.runInNewContext(wrapped, context);
}

test('each new round shuffles the question order without mutating the original list', () => {
  const app = loadQuizApp();
  const originalOrder = app.questions.map((question) => question.prompt);
  const roundOneOrder = app.startNewRound().map((question) => question.prompt);

  assert.equal(roundOneOrder.length, originalOrder.length);
  assert.deepEqual([...roundOneOrder].sort(), [...originalOrder].sort());
  assert.deepEqual(app.questions.map((question) => question.prompt), originalOrder);
  assert.ok(roundOneOrder.some((prompt, index) => prompt !== originalOrder[index]));

  const roundTwoOrder = app.startNewRound().map((question) => question.prompt);
  assert.equal(roundTwoOrder.length, originalOrder.length);
  assert.deepEqual([...roundTwoOrder].sort(), [...originalOrder].sort());
  assert.deepEqual(app.questions.map((question) => question.prompt), originalOrder);
  assert.notDeepEqual(roundTwoOrder, roundOneOrder);
});

test('the round keeps the original question data tied to each answer set after shuffling', () => {
  const app = loadQuizApp();
  const originalQuestion = app.questions[0];
  const currentRound = app.startNewRound();
  const shuffledQuestion = currentRound.find((question) => question.prompt === originalQuestion.prompt);

  assert.ok(shuffledQuestion);
  assert.deepEqual(shuffledQuestion.answers, originalQuestion.answers);
  assert.equal(shuffledQuestion.correct, originalQuestion.correct);
  assert.equal(shuffledQuestion.fact, originalQuestion.fact);
});
