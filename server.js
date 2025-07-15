const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Cache variables
let lastStockData = null;
let lastWeatherData = null;

// Helper functions
const fetchStockData = async () => {
    try {
        const response = await axios.get('https://growagarden.gg/stocks');
        const $ = cheerio.load(response.data);
        
        const parseStockList = (selector) => {
            const items = [];
            $(selector).each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(.*?) - Available Stock: (\d+)/i);
                if (match) {
                    items.push({
                        name: match[1],
                        stock: match[2]
                    });
                }
            });
            return items;
        };

        const seedStocks = parseStockList('h3:contains("Current Seed Shop Stock in Grow a Garden") + ul > li');
        const gearStocks = parseStockList('h3:contains("Current Gear Shop Stock in Grow a Garden") + ul > li');
        const eggStocks = parseStockList('h3:contains("Current Egg Shop Stock in Grow a Garden") + ul > li');

        const now = moment().tz('Asia/Jakarta');
        const minutes = now.minutes();
        const roundedMinutes = Math.floor(minutes / 5) * 5;
        const roundedTime = now.clone().minutes(roundedMinutes).seconds(0);
        const displayTime = roundedTime.format('D MMMM YYYY, HH:mm [WIB]');

        return {
            timestamp: displayTime,
            seedStocks,
            gearStocks,
            eggStocks,
            lastUpdated: new Date()
        };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        return null;
    }
};

const fetchWeatherData = async () => {
    try {
        const response = await axios.get('https://growagarden.gg/weather');
        const $ = cheerio.load(response.data);
        
        const now = moment().tz('Asia/Jakarta');
        const displayTime = now.format('D MMMM YYYY, HH:mm [WIB]');

        return {
            timestamp: displayTime,
            currentWeather: $('h2:contains("Current Weather") + p').text().trim(),
            temperature: $('p:contains("Temperature")').text().trim(),
            humidity: $('p:contains("Humidity")').text().trim(),
            wind: $('p:contains("Wind")').text().trim(),
            forecast: $('h3:contains("Weather Forecast") + p').text().trim(),
            lastUpdated: new Date()
        };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
};

// Check for new stock every 5 minutes
const checkForNewStock = async () => {
    const newStockData = await fetchStockData();
    
    if (lastStockData && newStockData) {
        // Compare with previous data to detect changes
        const newItems = {
            seedStocks: [],
            gearStocks: [],
            eggStocks: []
        };

        // Check seed stocks
        newStockData.seedStocks.forEach(newItem => {
            const oldItem = lastStockData.seedStocks.find(item => item.name === newItem.name);
            if (!oldItem || oldItem.stock !== newItem.stock) {
                newItems.seedStocks.push(newItem);
            }
        });

        // Check gear stocks
        newStockData.gearStocks.forEach(newItem => {
            const oldItem = lastStockData.gearStocks.find(item => item.name === newItem.name);
            if (!oldItem || oldItem.stock !== newItem.stock) {
                newItems.gearStocks.push(newItem);
            }
        });

        // Check egg stocks
        newStockData.eggStocks.forEach(newItem => {
            const oldItem = lastStockData.eggStocks.find(item => item.name === newItem.name);
            if (!oldItem || oldItem.stock !== newItem.stock) {
                newItems.eggStocks.push(newItem);
            }
        });

        // If there are changes, send notification
        if (newItems.seedStocks.length > 0 || newItems.gearStocks.length > 0 || newItems.eggStocks.length > 0) {
            io.emit('stock-update', {
                message: 'New stock available!',
                newItems,
                timestamp: newStockData.timestamp
            });
        }
    }

    lastStockData = newStockData;
    return newStockData;
};

// Routes
app.get('/', async (req, res) => {
    const stockData = lastStockData || await fetchStockData();
    const weatherData = lastWeatherData || await fetchWeatherData();
    
    res.render('index', {
        stockData,
        weatherData
    });
});

// API endpoints
app.get('/api/stocks', async (req, res) => {
    const data = await checkForNewStock();
    res.json(data);
});

app.get('/api/weather', async (req, res) => {
    const data = await fetchWeatherData();
    lastWeatherData = data;
    res.json(data);
});

// Initialize data
const initialize = async () => {
    lastStockData = await fetchStockData();
    lastWeatherData = await fetchWeatherData();
    
    // Schedule periodic updates
    setInterval(checkForNewStock, 5 * 60 * 1000); // Every 5 minutes
    setInterval(async () => {
        lastWeatherData = await fetchWeatherData();
    }, 30 * 60 * 1000); // Every 30 minutes
};

initialize();

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
