package utp.edu.pe.cruce_horarios.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "reprogramaciones")
public class Reprogramacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "docente_codigo", nullable = false, length = 50)
    private String docenteCodigo;

    @Column(name = "curso", nullable = false, length = 150)
    private String curso;

    @Convert(converter = LocalDateStringConverter.class)
    @Column(name = "fecha", nullable = false, length = 20)
    private LocalDate fecha;

    @Convert(converter = LocalTimeStringConverter.class)
    @Column(name = "hora_inicio", nullable = false, length = 20)
    private LocalTime horaInicio;

    @Convert(converter = LocalTimeStringConverter.class)
    @Column(name = "hora_fin", nullable = false, length = 20)
    private LocalTime horaFin;

    @Column(name = "aula", length = 50)
    private String aula;

    @Column(name = "estado", length = 30)
    private String estado = "SOLICITADO";

    public Reprogramacion() {}

    public Reprogramacion(String docenteCodigo, String curso, LocalDate fecha, LocalTime horaInicio, LocalTime horaFin) {
        this.docenteCodigo = docenteCodigo;
        this.curso = curso;
        this.fecha = fecha;
        this.horaInicio = horaInicio;
        this.horaFin = horaFin;
    }

    public Reprogramacion(String docenteCodigo, String curso, LocalDate fecha, LocalTime horaInicio, LocalTime horaFin, String aula) {
        this(docenteCodigo, curso, fecha, horaInicio, horaFin);
        this.aula = aula;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDocenteCodigo() { return docenteCodigo; }
    public void setDocenteCodigo(String docenteCodigo) { this.docenteCodigo = docenteCodigo; }

    public String getCurso() { return curso; }
    public void setCurso(String curso) { this.curso = curso; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public LocalTime getHoraInicio() { return horaInicio; }
    public void setHoraInicio(LocalTime horaInicio) { this.horaInicio = horaInicio; }

    public LocalTime getHoraFin() { return horaFin; }
    public void setHoraFin(LocalTime horaFin) { this.horaFin = horaFin; }

    public String getAula() { return aula; }
    public void setAula(String aula) { this.aula = aula; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
