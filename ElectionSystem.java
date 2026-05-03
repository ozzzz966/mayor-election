import com.sun.net.httpserver.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public class ElectionSystem {
    private static final String PASSWORD = "1234";
    private static final String FILE_PATH = "./candidates.json";
    private static List<Candidate> candidates = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        loadCandidates();
        
        HttpServer server = HttpServer.create(new java.net.InetSocketAddress(4567), 0);
        
        // GET /api/candidates - отримати список
        server.createContext("/api/candidates", exchange -> {
            if ("GET".equals(exchange.getRequestMethod())) {
                String json = "[";
                for (int i = 0; i < candidates.size(); i++) {
                    json += candidates.get(i).toJson();
                    if (i < candidates.size() - 1) json += ",";
                }
                json += "]";
                sendResponse(exchange, json, 200);
            }
            // POST /api/candidates - додати кандидата
            else if ("POST".equals(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                String password = getQueryParam(query, "password");
                if (!PASSWORD.equals(password)) {
                    sendResponse(exchange, "{\"error\":\"Wrong password\"}", 403);
                    return;
                }
                String body = readBody(exchange);
                Candidate c = parseCandidate(body);
                if (c != null) {
                    candidates.add(c);
                    saveCandidates();
                    sendResponse(exchange, "{\"status\":\"OK\"}", 200);
                } else {
                    sendResponse(exchange, "{\"error\":\"Invalid data\"}", 400);
                }
            }
        });
        
        // DELETE /api/candidates/{name} - видалити кандидата
        server.createContext("/api/candidates/", exchange -> {
            if ("DELETE".equals(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                String password = getQueryParam(query, "password");
                if (!PASSWORD.equals(password)) {
                    sendResponse(exchange, "{\"error\":\"Wrong password\"}", 403);
                    return;
                }
                String name = URLDecoder.decode(exchange.getRequestURI().getPath().replaceAll("/api/candidates/", ""), StandardCharsets.UTF_8);
                candidates.removeIf(c -> c.getName().equalsIgnoreCase(name));
                saveCandidates();
                sendResponse(exchange, "{\"status\":\"OK\"}", 200);
            }
        });
        
        // Статичні файли (HTML, CSS, JS)
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
        System.out.println("Сервер запущений на http://localhost:4567");
        System.out.println(" Відкрийте у браузері: http://localhost:4567");
        System.out.println(" Пароль: " + PASSWORD);
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
        while ((line = reader.readLine()) != null) {
            body.append(line);
        }
        return body.toString();
    }

    private static Candidate parseCandidate(String json) {
        try {
            json = json.trim();
            if (json.startsWith("{") && json.endsWith("}")) {
                Map<String, String> data = new HashMap<>();
                String[] pairs = json.substring(1, json.length()-1).split(",");
                for (String pair : pairs) {
                    String[] kv = pair.split(":");
                    if (kv.length == 2) {
                        String key = kv[0].trim().replaceAll("[\"\\\\]", "");
                        String val = kv[1].trim().replaceAll("[\"\\\\]", "");
                        data.put(key, val);
                    }
                }
                String name = data.get("name");
                String birthDate = data.get("birthDate");
                String birthPlace = data.get("birthPlace");
                int index = Integer.parseInt(data.get("popularityIndex"));
                return new Candidate(name, birthDate, birthPlace, index);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private static String getQueryParam(String query, String param) {
        if (query == null) return "";
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=");
            if (kv.length == 2 && kv[0].equals(param)) {
                try {
                    return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
                } catch (Exception e) {
                    return "";
                }
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

    private static void loadCandidates() {
        try {
            File file = new File(FILE_PATH);
            if (!file.exists()) {
                saveCandidates();
                return;
            }
            String content = new String(Files.readAllBytes(file.toPath()));
            parseCandidatesFromJson(content);
        } catch (Exception e) {
            System.out.println(" Помилка при завантаженні: " + e.getMessage());
        }
    }

    private static void parseCandidatesFromJson(String json) {
        candidates.clear();
        json = json.trim();
        if (json.startsWith("[") && json.endsWith("]")) {
            String content = json.substring(1, json.length() - 1);
            if (content.isEmpty()) return;
            
            int depth = 0;
            StringBuilder obj = new StringBuilder();
            for (char c : content.toCharArray()) {
                if (c == '{') depth++;
                if (c == '}') depth--;
                obj.append(c);
                if (depth == 0 && c == '}') {
                    Candidate c2 = parseCandidate(obj.toString());
                    if (c2 != null) candidates.add(c2);
                    obj = new StringBuilder();
                }
            }
        }
    }

    private static void saveCandidates() {
        try {
            String json = "[";
            for (int i = 0; i < candidates.size(); i++) {
                json += candidates.get(i).toJson();
                if (i < candidates.size() - 1) json += ",";
            }
            json += "]";
            Files.write(Paths.get(FILE_PATH), json.getBytes());
        } catch (Exception e) {
            System.out.println(" Помилка при збереженні: " + e.getMessage());
        }
    }
}
