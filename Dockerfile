FROM eclipse-temurin:21-jdk

WORKDIR /app

# PostgreSQL JDBC driver
RUN apt-get update && apt-get install -y wget && \
    wget -q https://jdbc.postgresql.org/download/postgresql-42.7.3.jar -O postgresql.jar

# 
COPY Candidate.java .
COPY ElectionSystem.java .
COPY index.html .
COPY style.css .
COPY script.js .
COPY candidates.json .

# Compile with PostgreSQL
RUN javac -cp postgresql.jar Candidate.java ElectionSystem.java

EXPOSE 8080

CMD ["java", "-cp", ".:postgresql.jar", "ElectionSystem"]
