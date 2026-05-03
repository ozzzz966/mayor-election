public class Candidate {
    private String name;
    private String birthDate;
    private String birthPlace;
    private int popularityIndex;

    public Candidate() {}

    public Candidate(String name, String birthDate, String birthPlace, int popularityIndex) {
        this.name = name;
        this.birthDate = birthDate;
        this.birthPlace = birthPlace;
        this.popularityIndex = popularityIndex;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getBirthDate() { return birthDate; }
    public void setBirthDate(String birthDate) { this.birthDate = birthDate; }

    public String getBirthPlace() { return birthPlace; }
    public void setBirthPlace(String birthPlace) { this.birthPlace = birthPlace; }

    public int getPopularityIndex() { return popularityIndex; }
    public void setPopularityIndex(int popularityIndex) { this.popularityIndex = popularityIndex; }

    @Override
    public String toString() {
        return name + ", " + birthDate + ", " + birthPlace + ", Індекс: " + popularityIndex;
    }
    
    public String toJson() {
        return String.format("{\"name\":\"%s\",\"birthDate\":\"%s\",\"birthPlace\":\"%s\",\"popularityIndex\":%d}",
            escapeJson(name), escapeJson(birthDate), escapeJson(birthPlace), popularityIndex);
    }
    
    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
