import com.sun.net.httpserver.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.*;

public class ElectionSystem {
    private static final String PASSWORD = "1234";
    private static Connection db;

    public static void main(String[] args) throws Exception {
        connectDB();
        createTable();

        int port = System.getenv("PORT") != null ? Integer.parseInt(System.getenv("PORT")) : 4567;
        HttpServer server = HttpServer.create(new java.net.InetSocketAddress(port), 0);

        // GET / POST /api/candidates
        server.createContext("/api/candidates", exchange -> {
            if ("GET".equals(exchange.getRequestMethod())) {
                String json = getCandidatesJson();
                sendResponse(exchange, json, 200);
            } else if ("POST".equals(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                String password = getQueryParam(query, "password");
                if (!PASSWORD.equals(password)) {
                    sendResponse(exchange, "{\"error\":\"Wrong password\"}", 403);
                    return;
                }
                String body = readBody(exchange);
                boolean ok = insertCandidate(body);
                if (ok) sendResponse(exchange, "{\"status\":\"OK\"}", 200);
                else sendResponse(exchange, "{\"error\":\"Invalid data\"}", 400);
            }
        });

        // DELETE /api/candidates/{name}
        server.createContext("/api/candidates/", exchange -> {
            if ("DELETE".equals(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                String password = getQueryParam(query, "password");
                if (!PASSWORD.equals(password)) {
                    sendResponse(exchange, "{\"error\":\"Wrong password\"}", 403);
                    return;
                }
                String name = URLDecoder.decode(
                    exchange.getRequestURI().getPath().replaceAll("/api/candidates/", ""),
                    StandardCharsets.UTF_8
                );
                deleteCandidate(name);
                sendResponse(exchange, "{\"status\":\"OK\"}", 200);
            }
        });

        // Static files
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/") || path.equals("")) path = "/index.html";
            try {
                File file = new File("." + path);
                if (file.exists() && file.isFile()) {
                    byte[] content = Files.readAllBytes(file.toPath());
                    String contentType = getContentType(path);
                    exchange.getResponseHeaders().set("Content-Type", contentType);
                    exchange.sendResponseHeaders(200, content.length);
                    exchange.getResponseBody().write(content);
                } else {
                    sendResponse(exchange, "404 Not Found", 404);
                }
            } catch (Exception e) {
                sendResponse(exchange, "500 Error", 500);
            }
            exchange.close();
        });

        server.setExecutor(null);
        server.start();
        System.out.println("Сервер запущений на порту: " + port);
    }

    // db
    private static void connectDB() {
        String url = System.getenv("DATABASE_URL");
        if (url == null) {
            System.out.println("DATABASE_URL не задано!");
            return;
        }
        try {
            // Railway: postgresql://user:pass@host:port/dbname
            url = url.replace("postgresql://", "");
            String userInfo = url.substring(0, url.indexOf('@'));
            String user = userInfo.split(":")[0];
            String pass = userInfo.split(":")[1];
            String hostAndDb = url.substring(url.indexOf('@') + 1);
            String jdbcUrl = "jdbc:postgresql://" + hostAndDb + "?sslmode=require";
            db = DriverManager.getConnection(jdbcUrl, user, pass);
            System.out.println("Підключено до PostgreSQL!");
        } catch (Exception e) {
            System.out.println("Помилка підключення до БД: " + e.getMessage());
        }
    }

    private static void createTable() {
        if (db == null) return;
        try {
            db.createStatement().execute(
                "CREATE TABLE IF NOT EXISTS candidates (" +
                "id SERIAL PRIMARY KEY," +
                "name VARCHAR(255) UNIQUE NOT NULL," +
                "birth_date VARCHAR(20)," +
                "birth_place VARCHAR(255)," +
                "popularity_index INT)"
            );
            System.out.println("Таблиця candidates готова");
        } catch (Exception e) {
            System.out.println("Помилка створення таблиці: " + e.getMessage());
        }
    }

    private static String getCandidatesJson() {
        if (db == null) return "[]";
        try {
            ResultSet rs = db.createStatement().executeQuery(
                "SELECT name, birth_date, birth_place, popularity_index FROM candidates ORDER BY id"
            );
            StringBuilder json = new StringBuilder("[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                json.append(String.format(
                    "{\"name\":\"%s\",\"birthDate\":\"%s\",\"birthPlace\":\"%s\",\"popularityIndex\":%d}",
                    escapeJson(rs.getString("name")),
                    escapeJson(rs.getString("birth_date")),
                    escapeJson(rs.getString("birth_place")),
                    rs.getInt("popularity_index")
                ));
                first = false;
            }
            json.append("]");
            return json.toString();
        } catch (Exception e) {
            System.out.println("Помилка читання: " + e.getMessage());
            return "[]";
        }
    }

    private static boolean insertCandidate(String body) {
        if (db == null) return false;
        try {
            Map<String, String> data = parseJson(body);
            PreparedStatement ps = db.prepareStatement(
                "INSERT INTO candidates (name, birth_date, birth_place, popularity_index) " +
                "VALUES (?, ?, ?, ?) ON CONFLICT (name) DO NOTHING"
            );
            ps.setString(1, data.get("name"));
            ps.setString(2, data.get("birthDate"));
            ps.setString(3, data.get("birthPlace"));
            ps.setInt(4, Integer.parseInt(data.get("popularityIndex")));
            ps.executeUpdate();
            return true;
        } catch (Exception e) {
            System.out.println("Помилка додавання: " + e.getMessage());
            return false;
        }
    }

    private static void deleteCandidate(String name) {
        if (db == null) return;
        try {
            PreparedStatement ps = db.prepareStatement(
                "DELETE FROM candidates WHERE LOWER(name) = LOWER(?)"
            );
            ps.setString(1, name);
            ps.executeUpdate();
        } catch (Exception e) {
            System.out.println("Помилка видалення: " + e.getMessage());
        }
    }

    // json parser
    private static Map<String, String> parseJson(String json) {
        Map<String, String> data = new HashMap<>();
        json = json.trim().replaceAll("^\\{|\\}$", "");
        int i = 0;
        while (i < json.length()) {
            int ks = json.indexOf('"', i) + 1;
            if (ks == 0) break;
            int ke = json.indexOf('"', ks);
            String key = json.substring(ks, ke);
            i = ke + 1;
            int colon = json.indexOf(':', i);
            i = colon + 1;
            while (i < json.length() && json.charAt(i) == ' ') i++;
            String value;
            if (i < json.length() && json.charAt(i) == '"') {
                int vs = i + 1;
                int ve = json.indexOf('"', vs);
                value = json.substring(vs, ve);
                i = ve + 1;
            } else {
                int ve = i;
                while (ve < json.length() && (Character.isDigit(json.charAt(ve)) || json.charAt(ve) == '-')) ve++;
                value = json.substring(i, ve);
                i = ve;
            }
            data.put(key, value);
            while (i < json.length() && (json.charAt(i) == ',' || json.charAt(i) == ' ')) i++;
        }
        return data;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void sendResponse(HttpExchange exchange, String response, int code) throws IOException {
        byte[] bytes = response.getBytes("UTF-8");
        exchange.getResponseHeaders().set("Content-Type", "application/json;charset=utf-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(code, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(exchange.getRequestBody()));
        StringBuilder body = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) body.append(line);
        return body.toString();
    }

    private static String getQueryParam(String query, String param) {
        if (query == null) return "";
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=");
            if (kv.length == 2 && kv[0].equals(param)) {
                try { return URLDecoder.decode(kv[1], StandardCharsets.UTF_8); }
                catch (Exception e) { return ""; }
            }
        }
        return "";
    }

    private static String getContentType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        return "text/plain";
    }
}
