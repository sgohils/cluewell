const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {analyze} = require('../dist/engine.js');

class Element {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.files = [];
    this.maxLength = -1;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  contains(element) { return this === element || this.children.includes(element); }
  reset() { for (const child of this.ownerDocument.elements.values()) { child.value = ''; child.checked = false; } }
  click() { if (this.onclick) this.onclick({target:this}); for (const fn of this.listeners.click || []) fn({target:this}); }
  submit() { this.onsubmit({preventDefault(){}}); }
}

function boot() {
  const elements = new Map();
  const document = {
    elements,
    activeElement: null,
    body: new Element('body', 'body'),
    head: new Element('head', 'head'),
    getElementById(id) {
      if (!elements.has(id)) {
        const element = new Element(id === 'assessment' ? 'form' : 'div', id);
        element.ownerDocument = document;
        elements.set(id, element);
      }
      return elements.get(id);
    },
    createElement(tag) { const el = new Element(tag); el.ownerDocument = document; return el; }
  };
  document.body.ownerDocument = document;
  document.activeElement = document.body;
  document.getElementById('startVoice').textContent = 'Start dictation';
  const context = {
    document,
    window: {ClueEngine:{analyze}},
    URL: {createObjectURL:()=> 'blob:photo', revokeObjectURL(){}},
    fetch: async () => ({ok:false}),
    setTimeout, clearTimeout, console,
    Error, Promise, Array, String, Math
  };
  const source = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');
  vm.runInNewContext(source, context, {filename:'dist/app.js'});
  return {document, get:id=>document.getElementById(id)};
}

test('submitting an empty entry keeps the user in the form with a clear prompt', () => {
  const {get} = boot();
  get('assessment').submit();
  assert.equal(get('mediaStatus').textContent, 'Tell us what you are feeling, add reviewed image notes, or select a current warning sign.');
  assert.equal(get('story').ownerDocument.activeElement, get('story'));
  assert.equal(get('results').children.length, 0);
});
