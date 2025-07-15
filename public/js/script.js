// Tab functionality
function openTab(tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }
    
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active");
    }
    
    document.getElementById(tabName).style.display = "block";
    event.currentTarget.classList.add("active");
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    fetch('/api/stocks')
        .then(response => response.json())
        .then(data => {
            if (data) {
                window.location.reload();
            }
        });
}, 5 * 60 * 1000);

// Socket.io for real-time notifications
const socket = io();

socket.on('stock-update', (data) => {
    showNotification(data.message, data.newItems);
});

function showNotification(message, newItems) {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let content = `<strong>${message}</strong><br>`;
    
    if (newItems.seedStocks.length > 0) {
        content += `<br><strong>Seed Shop:</strong>`;
        newItems.seedStocks.forEach(item => {
            content += `<br>• ${item.name} (${item.stock}x)`;
        });
    }
    
    if (newItems.gearStocks.length > 0) {
        content += `<br><strong>Gear Shop:</strong>`;
        newItems.gearStocks.forEach(item => {
            content += `<br>• ${item.name} (${item.stock}x)`;
        });
    }
    
    if (newItems.eggStocks.length > 0) {
        content += `<br><strong>Egg Shop:</strong>`;
        newItems.eggStocks.forEach(item => {
            content += `<br>• ${item.name} (${item.stock}x)`;
        });
    }
    
    content += `<br><small>Updated: ${new Date().toLocaleTimeString()}</small>`;
    
    notification.innerHTML = content;
    container.appendChild(notification);
    
    // Remove notification after click
    notification.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode === container) {
            notification.remove();
        }
    }, 5000);
}

// Request notification permission when page loads
document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }
});
