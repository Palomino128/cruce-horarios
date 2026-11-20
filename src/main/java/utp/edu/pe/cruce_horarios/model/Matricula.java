package utp.edu.pe.cruce_horarios.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "matriculas")
public class Matricula {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "estudiante_codigo", nullable = false, length = 50)
    private String estudianteCodigo;

    @Column(name = "curso", nullable = false, length = 150)
    private String curso;

    public Matricula() {}

    public Matricula(String estudianteCodigo, String curso) {
        this.estudianteCodigo = estudianteCodigo;
        this.curso = curso;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEstudianteCodigo() { return estudianteCodigo; }
    public void setEstudianteCodigo(String estudianteCodigo) { this.estudianteCodigo = estudianteCodigo; }

    public String getCurso() { return curso; }
    public void setCurso(String curso) { this.curso = curso; }
}
