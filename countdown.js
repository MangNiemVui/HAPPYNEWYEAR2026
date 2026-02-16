// Countdown overlay (runs before login)
(function(){
  const overlay = document.getElementById('countdownOverlay');
  if (!overlay) return;

  const elDays = document.getElementById('days');
  const elHours = document.getElementById('hours');
  const elMinutes = document.getElementById('minutes');
  const elSeconds = document.getElementById('seconds');
  const btnSkip = document.getElementById('btnSkipCountdown');

  // Tết 2026 (Bính Ngọ) rơi vào 17/02/2026 (giờ địa phương).
  // Bạn có thể đổi mốc này nếu muốn.
  const TARGET = new Date('Feb 17, 2026 00:00:00').getTime();

  function hide(){
    overlay.classList.add('hidden');
  }

  function setNum(el, n){
    if (!el) return;
    el.textContent = String(Math.max(0, n));
  }

  function tick(){
    const now = Date.now();
    const diff = TARGET - now;
    if (!Number.isFinite(diff) || diff <= 0){
      hide();
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const minutes = Math.floor(diff / (1000 * 60)) % 60;
    const seconds = Math.floor(diff / 1000) % 60;

    setNum(elDays, days);
    setNum(elHours, hours);
    setNum(elMinutes, minutes);
    setNum(elSeconds, seconds);
  }

  btnSkip?.addEventListener('click', hide);

  tick();
  setInterval(tick, 1000);
})();
