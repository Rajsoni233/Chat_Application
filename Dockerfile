# Use official Java image
FROM eclipse-temurin:21-jdk-alpine

# Set working directory
WORKDIR /app

# Copy jar file from target folder
COPY target/*.jar app.jar

# Expose port (Render will override via PORT env)
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]