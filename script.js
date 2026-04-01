(() => {
  'use strict';

  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const historyBtn = document.getElementById('historyBtn');
  const clearHistoryBtn = document.getElementById('clearHistory');

  let expression = '';
  let lastResult = null;
  let history = JSON.parse(localStorage.getItem('calcHistory') || '[]');
  let justEvaluated = false;

  // --- Display ---

  function updateDisplay() {
    expressionEl.textContent = formatExpression(expression);
    const display = lastResult !== null ? formatNumber(lastResult) : '0';
    resultEl.textContent = display;
    resultEl.classList.toggle('small', display.length > 12);
    resultEl.classList.remove('error');
  }

  function showError(msg) {
    resultEl.textContent = msg;
    resultEl.classList.add('error');
  }

  function formatExpression(expr) {
    return expr
      .replace(/\*/g, '\u00D7')
      .replace(/\//g, '\u00F7')
      .replace(/-/g, '\u2212');
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return 'Error';
    if (!isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity';
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString('en-US');
    const s = n.toPrecision(10);
    return parseFloat(s).toString();
  }

  // --- Evaluation ---

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function evaluate(expr) {
    // Replace display symbols with math
    let e = expr
      .replace(/π/g, `(${Math.PI})`)
      .replace(/e(?![a-z])/g, `(${Math.E})`)
      .replace(/(\d)(\()/g, '$1*(')       // implicit mult: 2(3) -> 2*(3)
      .replace(/(\))(\d)/g, '$1*$2')       // implicit mult: (3)2 -> (3)*2
      .replace(/(\))(\()/g, '$1*(');       // implicit mult: (3)(2) -> (3)*(2)

    // Handle percentage: convert trailing % to /100
    e = e.replace(/(\d+\.?\d*)%/g, '($1/100)');

    // Handle scientific functions
    e = e.replace(/sin\(([^)]+)\)/g, (_, a) => `Math.sin(${a}*Math.PI/180)`);
    e = e.replace(/cos\(([^)]+)\)/g, (_, a) => `Math.cos(${a}*Math.PI/180)`);
    e = e.replace(/tan\(([^)]+)\)/g, (_, a) => `Math.tan(${a}*Math.PI/180)`);
    e = e.replace(/log\(([^)]+)\)/g, 'Math.log10($1)');
    e = e.replace(/ln\(([^)]+)\)/g, 'Math.log($1)');
    e = e.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
    e = e.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');
    e = e.replace(/fact\(([^)]+)\)/g, 'factorial($1)');

    // Handle power operator
    e = e.replace(/\^/g, '**');

    // Validate: only allow safe characters
    if (/[^0-9+\-*/().eE, Mathlgsqrtincoabfpw]/.test(e.replace(/factorial/g, ''))) {
      return NaN;
    }

    try {
      // Use Function constructor with factorial in scope
      const fn = new Function('factorial', `"use strict"; return (${e});`);
      const result = fn(factorial);
      return typeof result === 'number' ? result : NaN;
    } catch {
      return NaN;
    }
  }

  // --- History ---

  function addHistory(expr, result) {
    history.unshift({ expr, result, time: Date.now() });
    if (history.length > 50) history.pop();
    localStorage.setItem('calcHistory', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No history yet</div>';
      return;
    }
    historyList.innerHTML = history.map((h, i) => `
      <div class="history-item" data-index="${i}">
        <div class="hist-expr">${formatExpression(h.expr)}</div>
        <div class="hist-result">${formatNumber(h.result)}</div>
      </div>
    `).join('');
  }

  // --- Input handling ---

  function handleAction(action) {
    switch (action) {
      case 'AC':
        expression = '';
        lastResult = null;
        justEvaluated = false;
        updateDisplay();
        return;

      case 'DEL':
        if (justEvaluated) {
          expression = '';
          lastResult = null;
          justEvaluated = false;
        } else {
          // Handle multi-char tokens like sin(, cos(, etc.
          const fns = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'abs(', 'fact('];
          let removed = false;
          for (const fn of fns) {
            if (expression.endsWith(fn)) {
              expression = expression.slice(0, -fn.length);
              removed = true;
              break;
            }
          }
          if (!removed) {
            expression = expression.slice(0, -1);
          }
        }
        updateDisplay();
        return;

      case '=': {
        if (!expression) return;
        const result = evaluate(expression);
        if (isNaN(result)) {
          showError('Error');
          return;
        }
        addHistory(expression, result);
        expressionEl.textContent = formatExpression(expression) + ' =';
        lastResult = result;
        expression = result.toString();
        resultEl.textContent = formatNumber(result);
        resultEl.classList.toggle('small', formatNumber(result).length > 12);
        resultEl.classList.remove('error');
        justEvaluated = true;
        return;
      }

      case 'sign':
        if (justEvaluated && lastResult !== null) {
          lastResult = -lastResult;
          expression = lastResult.toString();
          justEvaluated = false;
          updateDisplay();
          return;
        }
        // Toggle sign of last number in expression
        if (expression) {
          const match = expression.match(/(.*?)(-?\d+\.?\d*)$/);
          if (match) {
            const prefix = match[1];
            const num = match[2];
            if (num.startsWith('-')) {
              expression = prefix + num.slice(1);
            } else {
              expression = prefix + '(-' + num + ')';
            }
          }
        }
        updateDisplay();
        return;

      case 'sin':
      case 'cos':
      case 'tan':
      case 'log':
      case 'ln':
      case 'sqrt':
      case 'abs':
      case 'fact':
        if (justEvaluated) {
          expression = action + '(' + expression;
          justEvaluated = false;
        } else {
          expression += action + '(';
        }
        updateDisplay();
        return;

      case 'pow':
        if (justEvaluated) justEvaluated = false;
        expression += '^';
        updateDisplay();
        return;

      case 'square':
        if (justEvaluated) justEvaluated = false;
        expression += '^2';
        updateDisplay();
        return;

      case 'inv':
        if (justEvaluated && lastResult !== null) {
          const inv = 1 / lastResult;
          expression = `1/(${expression})`;
          lastResult = inv;
          justEvaluated = false;
          updateDisplay();
          return;
        }
        expression = `1/(${expression})`;
        updateDisplay();
        return;

      case 'pi':
        if (justEvaluated) {
          expression = 'π';
          justEvaluated = false;
        } else {
          expression += 'π';
        }
        updateDisplay();
        return;

      case 'e':
        if (justEvaluated) {
          expression = 'e';
          justEvaluated = false;
        } else {
          expression += 'e';
        }
        updateDisplay();
        return;

      default:
        // Numbers, operators, parens, decimal, percent
        if (justEvaluated) {
          if ('+-*/^%'.includes(action)) {
            // Continue with result
            justEvaluated = false;
          } else {
            // Start fresh
            expression = '';
            lastResult = null;
            justEvaluated = false;
          }
        }
        expression += action;
        updateDisplay();
        return;
    }
  }

  // --- Event listeners ---

  document.querySelector('.buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    handleAction(btn.dataset.action);
  });

  historyBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('open');
  });

  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('calcHistory');
    renderHistory();
  });

  historyList.addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (!item) return;
    const idx = parseInt(item.dataset.index);
    const h = history[idx];
    expression = h.result.toString();
    lastResult = h.result;
    justEvaluated = true;
    historyPanel.classList.remove('open');
    updateDisplay();
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (historyPanel.classList.contains('open')) {
      if (e.key === 'Escape') historyPanel.classList.remove('open');
      return;
    }

    const key = e.key;
    const map = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '+': '+', '-': '-', '*': '*', '/': '/',
      '(': '(', ')': ')', '.': '.', '%': '%',
      'Enter': '=', '=': '=',
      'Backspace': 'DEL', 'Delete': 'AC', 'Escape': 'AC',
    };

    if (map[key]) {
      e.preventDefault();
      handleAction(map[key]);
    } else if (key === 's') {
      handleAction('sin');
    } else if (key === 'c') {
      handleAction('cos');
    } else if (key === 't') {
      handleAction('tan');
    } else if (key === 'l') {
      handleAction('log');
    } else if (key === 'p') {
      handleAction('pi');
    } else if (key === '^') {
      e.preventDefault();
      handleAction('pow');
    }
  });

  // Init
  renderHistory();
  updateDisplay();
})();
