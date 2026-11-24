'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const results = byId('results');
  const form = byId('assessment');
  if (!results || !form) return;

  const create = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  const clearPaper = () => {
    document.body.classList.remove('handoff-printing');
    byId('handoff-paper')?.remove();
  };
  window.addEventListener('afterprint', clearPaper);

  let currentReview;
  let panel;
  let shortcut;
  const refresh = () => {
    const review = results.querySelector('.review-box');
    if (review === currentReview) return;
    currentReview = review;
    panel?.remove();
    shortcut?.remove();
    panel = null;
    shortcut = null;
    clearPaper();
    if (!review || results.dataset.level === 'emergency') return;

    const story = byId('story').value.trim().slice(0, 8000);
    const risk = byId('risk').value;
    const notes = !byId('imagePanel').hidden && byId('photoConfirm').checked
      ? byId('imageNote').value.trim().slice(0, 4000)
      : '';
    const reviewTitle = review.querySelector('h2').textContent;
    const guide = review.querySelector('a[target="_blank"]');

    panel = create('section', '', 'handoff');
    panel.setAttribute('aria-labelledby', 'handoff-heading');
    const heading = create('h2', 'Prepare a clinician handoff');
    heading.id = 'handoff-heading';
    heading.tabIndex = -1;
    shortcut = create('button', 'Prepare a clinician handoff', 'secondary handoff-shortcut');
    shortcut.type = 'button';
    shortcut.addEventListener('click', () => {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    });
    const label = create('label', 'Your handoff note');
    label.htmlFor = 'handoff-draft';
    const draft = create('textarea');
    draft.id = 'handoff-draft';
    draft.rows = 7;
    draft.value = [
      story && `My symptom story\n${story}`,
      notes && `My reviewed image notes\n${notes}`,
      risk !== 'unknown' && `Higher risk of severe illness (my response)\n${byId('risk').selectedOptions[0].textContent}`,
    ].filter(Boolean).join('\n\n');

    const includeReview = create('input');
    includeReview.type = 'checkbox';
    const includeLabel = create('label', '', 'handoff-check');
    includeLabel.append(includeReview, create('span', 'Include Cluewell’s educational review'));
    const reviewPreview = create('div', '', 'handoff-review');
    reviewPreview.hidden = true;
    reviewPreview.append(create('p', reviewTitle));
    if (guide) {
      const guideLink = guide.cloneNode(true);
      reviewPreview.append(guideLink);
    }
    const reviewed = create('input');
    reviewed.type = 'checkbox';
    const reviewedLabel = create('label', '', 'handoff-check');
    reviewedLabel.append(reviewed, create('span', 'I reviewed this note and am ready to share it.'));

    const actions = create('div', '', 'handoff-actions');
    const copy = create('button', 'Copy handoff', 'secondary');
    copy.type = 'button';
    const print = create('button', 'Print handoff', 'secondary');
    print.type = 'button';
    actions.append(copy, print);

    const status = create('p', '', 'handoff-status');
    status.setAttribute('role', 'status');
    const fallback = create('div');
    fallback.hidden = true;
    const fallbackLabel = create('label', 'Handoff text');
    fallbackLabel.htmlFor = 'handoff-copy-text';
    const copyText = create('textarea');
    copyText.id = 'handoff-copy-text';
    copyText.readOnly = true;
    copyText.rows = 7;
    fallback.append(fallbackLabel, copyText);

    const sections = () => {
      const content = [{ heading: 'Patient note', text: draft.value.trim() }];
      if (includeReview.checked) {
        content.push({ heading: 'Cluewell educational review', text: [reviewTitle, guide?.href].filter(Boolean).join('\n') });
      }
      return content;
    };
    const noteBody = () => ['Clinician handoff', ...sections().flatMap(({ heading, text }) => [heading, text])].join('\n\n');
    const syncReview = () => {
      reviewed.disabled = !draft.value.trim();
      copy.disabled = print.disabled = !reviewed.checked;
      fallback.hidden = true;
      copyText.value = '';
      clearPaper();
    };
    const invalidateReview = () => {
      const wasReviewed = reviewed.checked;
      reviewed.checked = false;
      syncReview();
      status.textContent = wasReviewed ? 'Note changed. Review it again before sharing.' : '';
    };
    draft.addEventListener('input', invalidateReview);
    includeReview.addEventListener('change', () => {
      reviewPreview.hidden = !includeReview.checked;
      invalidateReview();
    });
    reviewed.addEventListener('change', () => {
      syncReview();
      status.textContent = '';
    });

    copy.addEventListener('click', async () => {
      if (!reviewed.checked || !draft.value.trim()) return;
      const content = noteBody();
      const isCurrent = () => copy.isConnected && reviewed.checked && noteBody() === content;
      try {
        await navigator.clipboard.writeText(content);
        if (isCurrent()) status.textContent = 'Handoff copied.';
      } catch {
        if (!isCurrent()) return;
        status.textContent = 'Use your device’s copy command to copy the selected handoff.';
        copyText.value = content;
        fallback.hidden = false;
        copyText.focus();
        copyText.select();
      }
    });
    print.addEventListener('click', () => {
      if (!reviewed.checked || !draft.value.trim()) return;
      clearPaper();
      const paper = create('article', '', 'handoff-paper');
      paper.id = 'handoff-paper';
      paper.append(create('h1', 'Clinician handoff'));
      for (const { heading, text } of sections()) {
        paper.append(create('h2', heading), create('p', text));
      }
      document.body.append(paper);
      document.body.classList.add('handoff-printing');
      try {
        window.print();
      } catch {
        clearPaper();
        status.textContent = 'Printing is unavailable. You can still copy the handoff.';
      }
    });
    syncReview();

    panel.append(heading, create('p', 'Edit your symptom story and add any questions you want to ask.'), label, draft, includeLabel, reviewPreview, reviewedLabel, actions, status, fallback);
    results.after(panel);
    const reviewFoot = results.querySelector('.review-foot');
    (reviewFoot || review).append(shortcut);
  };

  new MutationObserver(refresh).observe(results, { childList: true });
  refresh();
})();
