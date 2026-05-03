FROM eclipse-temurin:21-jdk

WORKDIR /app

# Copy all source and static files
COPY Candidate.java .
COPY ElectionSystem.java .
COPY index.html .
COPY style.css .
COPY script.js .
COPY candidates.json .

# Compile Java
RUN javac Candidate.java ElectionSystem.java

# Use Railway's PORT env variable
ENV PORT=4567

EXPOSE 4567

CMD ["java", "ElectionSystem"]
