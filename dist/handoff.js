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
  window.matchMedia('print').addEventListener('change', event => {
    if (!event.matches) clearPaper();
  });

  let currentReview;
  let dispose = clearPaper;
  const refresh = () => {
    const review = results.querySelector('.review-box');
    if (review === currentReview) return;
    currentReview = review;
    dispose();
    dispose = clearPaper;
    if (!review || results.dataset.level === 'emergency') return;

    const story = byId('story').value.trim().slice(0, 8000);
    const risk = byId('risk').value;
    const notes = !byId('imagePanel').hidden && byId('photoConfirm').checked
      ? byId('imageNote').value.trim().slice(0, 4000)
      : '';
    const reviewTitle = review.querySelector('h2').textContent;
    const guide = review.querySelector('a[target="_blank"]');

    const panel = create('section', '', 'handoff');
    panel.id = 'handoff-panel';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'handoff-heading');
    const heading = create('h2', 'Prepare a clinician handoff');
    heading.id = 'handoff-heading';
    heading.tabIndex = -1;
    const shortcut = create('button', 'Prepare a clinician handoff', 'secondary handoff-shortcut');
    shortcut.type = 'button';
    shortcut.setAttribute('aria-controls', panel.id);
    shortcut.setAttribute('aria-expanded', 'false');
    const label = create('label', 'Your handoff note');
    label.htmlFor = 'handoff-draft';
    const draft = create('textarea');
    draft.id = 'handoff-draft';
    draft.rows = 7;
    draft.autocomplete = 'off';
    draft.spellcheck = false;
    let started = false;
    shortcut.addEventListener('click', () => {
      if (!panel.hidden) {
        hideHandoff();
        return;
      }
      if (!started) {
        draft.value = [
          story && `My symptom story\n${story}`,
          notes && `My reviewed image notes\n${notes}`,
          risk !== 'unknown' && `Higher risk of severe illness (my response)\n${byId('risk').selectedOptions[0].textContent}`,
        ].filter(Boolean).join('\n\n');
        started = true;
        syncReview();
      }
      panel.hidden = false;
      shortcut.setAttribute('aria-expanded', 'true');
      shortcut.textContent = 'Hide clinician handoff';
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    });

    const includeReview = create('input');
    includeReview.type = 'checkbox';
    const includeLabel = create('label', '', 'handoff-check');
    includeLabel.append(includeReview, create('span', 'Include the Cluewell review headline and guidance link'));
    const reviewPreview = create('div', '', 'handoff-review');
    reviewPreview.id = 'handoff-review-preview';
    reviewPreview.hidden = true;
    includeReview.setAttribute('aria-controls', reviewPreview.id);
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
    const hide = create('button', 'Hide handoff', 'secondary');
    hide.type = 'button';
    actions.append(copy, print, hide);

    const status = create('p', '', 'handoff-status');
    status.id = 'handoff-status';
    status.setAttribute('role', 'status');
    const fallback = create('div');
    fallback.hidden = true;
    const fallbackLabel = create('label', 'Handoff text');
    fallbackLabel.htmlFor = 'handoff-copy-text';
    const copyText = create('textarea');
    copyText.id = 'handoff-copy-text';
    copyText.readOnly = true;
    copyText.rows = 7;
    copyText.spellcheck = false;
    copyText.setAttribute('aria-describedby', status.id);
    fallback.append(fallbackLabel, copyText);

    const sections = () => {
      const content = [{ heading: 'Patient note', text: draft.value.trim() }];
      if (includeReview.checked) {
        content.push({ heading: 'Cluewell educational review', text: [reviewTitle, guide?.href].filter(Boolean).join('\n') });
      }
      return content;
    };
    const noteBody = () => ['Clinician handoff', ...sections().flatMap(({ heading, text }) => [heading, text])].join('\n\n');
    let copyRevision = 0;
    let copyInProgress = false;
    const clearFallback = () => {
      fallback.hidden = true;
      copyText.value = '';
    };
    const syncReview = () => {
      copyRevision++;
      reviewed.disabled = !draft.value.trim();
      copy.disabled = print.disabled = !reviewed.checked;
      clearFallback();
      clearPaper();
    };
    const invalidateReview = () => {
      const wasReviewed = reviewed.checked;
      reviewed.checked = false;
      syncReview();
      if (wasReviewed) status.textContent = 'Note changed. Review it again before sharing.';
    };
    const hideHandoff = () => {
      reviewed.checked = false;
      syncReview();
      status.textContent = '';
      panel.hidden = true;
      shortcut.setAttribute('aria-expanded', 'false');
      shortcut.textContent = 'Prepare a clinician handoff';
      shortcut.focus({ preventScroll: true });
      shortcut.scrollIntoView({ block: 'nearest' });
    };
    hide.addEventListener('click', hideHandoff);
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
      if (copyInProgress || !reviewed.checked || !draft.value.trim()) return;
      const revision = copyRevision;
      const content = noteBody();
      const isCurrent = () => copy.isConnected && revision === copyRevision && reviewed.checked && noteBody() === content;
      copyInProgress = true;
      copy.setAttribute('aria-disabled', 'true');
      draft.readOnly = true;
      includeReview.disabled = true;
      reviewed.disabled = true;
      print.disabled = true;
      hide.disabled = true;
      shortcut.disabled = true;
      clearFallback();
      status.textContent = 'Copying handoff…';
      const slowCopyTimer = window.setTimeout(() => {
        if (copyInProgress && isCurrent()) {
          status.textContent = 'Clipboard access is taking longer than expected. Keep this handoff open while your browser finishes.';
        }
      }, 5000);
      try {
        await navigator.clipboard.writeText(content);
        if (isCurrent()) status.textContent = 'Handoff copied.';
      } catch {
        if (!isCurrent()) return;
        copyText.value = content;
        fallback.hidden = false;
        if (document.activeElement === copy) {
          copyText.focus();
          copyText.select();
          status.textContent = 'Use your device’s copy command to copy the selected handoff.';
        } else {
          status.textContent = 'Select the handoff text below and use your device’s copy command.';
        }
      } finally {
        window.clearTimeout(slowCopyTimer);
        copyInProgress = false;
        copy.removeAttribute('aria-disabled');
        draft.readOnly = false;
        includeReview.disabled = false;
        print.disabled = false;
        hide.disabled = false;
        shortcut.disabled = false;
        if (panel.isConnected) {
          reviewed.disabled = !draft.value.trim();
          copy.disabled = print.disabled = !reviewed.checked;
        }
      }
    });
    print.addEventListener('click', () => {
      if (byId('handoff-paper') || !reviewed.checked || !draft.value.trim()) return;
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

    panel.append(heading, create('p', 'Edit your symptom story and add any questions you want to ask. Confirm the note before copying or printing it.'), label, draft, includeLabel, reviewPreview, reviewedLabel, actions, status, fallback);
    results.after(panel);
    const reviewFoot = results.querySelector('.review-foot');
    (reviewFoot || review).append(shortcut);
    dispose = () => {
      draft.value = '';
      reviewed.checked = false;
      syncReview();
      panel.remove();
      shortcut.remove();
    };
  };

  new MutationObserver(refresh).observe(results, { childList: true });
  window.addEventListener('pagehide', () => {
    dispose();
    dispose = clearPaper;
    currentReview = undefined;
  });
  window.addEventListener('pageshow', refresh);
  refresh();
})();
