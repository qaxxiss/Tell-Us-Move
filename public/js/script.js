
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger) hamburger.addEventListener('click', ()=> navMenu.classList.toggle('show'));
