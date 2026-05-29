import { clearStoredUser } from '../../stores/session-store.js';

document.addEventListener('DOMContentLoaded', () => {
    const logoutLinks = document.querySelectorAll('.nav-logout');
    if (!logoutLinks.length) return;

    logoutLinks.forEach((link) => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const target = link.getAttribute('href') || '../index.html';
            try {
                if (typeof signOutUser === 'function') {
                    await signOutUser();
                } else {
                    clearStoredUser();
                }
            } catch (error) {
                console.warn('Erro ao sair:', error);
            }
            window.location.href = target;
        });
    });
});
