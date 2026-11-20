package utp.edu.pe.cruce_horarios.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalTime;

@Entity
@Table(name = "horarios")
public class Horario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "docente_codigo", nullable = false, length = 50)
    private String docenteCodigo;

    @Column(name = "curso", nullable = false, length = 150)
    private String curso;

    @Enumerated(EnumType.STRING)
    @Column(name = "dia", nullable = false, length = 20)
    private DayOfWeek dia;

    @Convert(converter = LocalTimeStringConverter.class)
    @Column(name = "hora_inicio", nullable = false, length = 20)
    private LocalTime horaInicio;

    @Convert(converter = LocalTimeStringConverter.class)
    @Column(name = "hora_fin", nullable = false, length = 20)
    private LocalTime horaFin;

    @Column(name = "aula", length = 50)
    private String aula;

    public Horario() {}

    public Horario(String docenteCodigo, String curso, DayOfWeek dia, LocalTime horaInicio, LocalTime horaFin) {
        this.docenteCodigo = docenteCodigo;
        this.curso = curso;
        this.dia = dia;
        this.horaInicio = horaInicio;
        this.horaFin = horaFin;
    }

    public Horario(String docenteCodigo, String curso, DayOfWeek dia, LocalTime horaInicio, LocalTime horaFin, String aula) {
        this(docenteCodigo, curso, dia, horaInicio, horaFin);
        this.aula = aula;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDocenteCodigo() { return docenteCodigo; }
    public void setDocenteCodigo(String docenteCodigo) { this.docenteCodigo = docenteCodigo; }

    public String getCurso() { return curso; }
    public void setCurso(String curso) { this.curso = curso; }

    public DayOfWeek getDia() { return dia; }
    public void setDia(DayOfWeek dia) { this.dia = dia; }

    public LocalTime getHoraInicio() { return horaInicio; }
    public void setHoraInicio(LocalTime horaInicio) { this.horaInicio = horaInicio; }

    public LocalTime getHoraFin() { return horaFin; }
    public void setHoraFin(LocalTime horaFin) { this.horaFin = horaFin; }

    public String getAula() { return aula; }
    public void setAula(String aula) { this.aula = aula; }
}
