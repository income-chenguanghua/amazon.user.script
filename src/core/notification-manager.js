export class NotificationManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'tm-inline-notifications';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 2600) {
        const notification = document.createElement('div');
        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        notification.className = `tm-inline-notification tm-inline-notification-${safeType}`;
        notification.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
        notification.textContent = message;
        this.container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'tm-inline-slide-out 0.3s ease forwards';
            setTimeout(() => notification.remove(), 280);
        }, duration);
    }
}
