# Use a lightweight Alpine Linux based Nginx image
FROM nginx:alpine

# Copy the exported Next.js application
COPY out/ /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Command to run Nginx
CMD ["nginx", "-g", "daemon off;"]
