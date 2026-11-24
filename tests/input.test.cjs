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
  document.getElementById('risk').value = 'unknown';
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

function content(element) {
  return element.textContent + element.children.map(content).join(' ');
}

test('submitting an empty entry keeps the user in the form with a clear prompt', () => {
  const {get} = boot();
  get('assessment').submit();
  assert.equal(get('mediaStatus').textContent, 'Tell us what you are feeling, add reviewed image notes, or select a current warning sign.');
  assert.equal(get('story').ownerDocument.activeElement, get('story'));
  assert.equal(get('results').children.length, 0);
});

test('a selected current warning sign can be reviewed without a written story', () => {
  const {get} = boot();
  get('redflag').checked = true;
  get('assessment').submit();
  assert.equal(get('results').dataset.level, 'emergency');
  assert.match(content(get('results')), /Input used: warning-sign selection\./);
  assert.equal(get('mediaStatus').textContent, '');
});

test('unconfirmed image notes stay out of review and are preserved for editing', () => {
  const {get} = boot();
  get('imageFile').files = [{type:'image/png', size:12}];
  get('imageFile').onchange({target:get('imageFile')});
  get('imageNote').value = 'A printed note with symptom details';
  get('assessment').submit();
  assert.equal(get('mediaStatus').textContent, 'Review the image notes and check the confirmation box, or remove the image.');
  assert.equal(get('imageNote').value, 'A printed note with symptom details');
  assert.equal(get('results').children.length, 0);
  assert.equal(get('photoConfirm').ownerDocument.activeElement, get('photoConfirm'));
});

test('confirmed image notes are labeled as a review input', () => {
  const {get} = boot();
  get('imageFile').files = [{type:'image/jpeg', size:12}];
  get('imageFile').onchange({target:get('imageFile')});
  get('imageNote').value = 'I have a runny nose and sneezing.';
  get('photoConfirm').checked = true;
  get('assessment').submit();
  assert.equal(get('results').dataset.level, 'guidance');
  assert.match(content(get('results')), /Input used: reviewed image notes\./);
  assert.match(content(get('results')), /runny nose/);
  assert.match(content(get('results')), /sneezing/);
});
