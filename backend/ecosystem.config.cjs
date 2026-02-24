module.exports = {
  apps: [
    {
      name: "ai-inventory-sales-api",
      cwd: "/Users/youvanneth/Desktop/Project/AI-Based_Inventory_and_Sales_Management_System/backend",
      script: "src/server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 5001
      }
    }
  ]
};
