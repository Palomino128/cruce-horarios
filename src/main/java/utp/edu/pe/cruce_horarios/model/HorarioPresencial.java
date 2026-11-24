package utp.edu.pe.cruce_horarios.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalTime;

@Entity
@Table(name = "horarios_presenciales")
public class HorarioPresencial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinador_curso", length = 150, nullable = true)
    private String coordinadorCurso;

    @Column(name = "cod_docente", length = 30, nullable = true)
    private String codDocente;

    @Column(name = "nom_docente", length = 150, nullable = true)
    private String nomDocente;

    @Column(name = "cod_curso", length = 30, nullable = false)
    private String codCurso;

    @Column(name = "curso", length = 200, nullable = false)
    private String curso;

    @Column(name = "catalogo", length = 50)
    private String catalogo;

    @Column(name = "ciclo", length = 20)
    private String ciclo;

    @Column(name = "seccion", length = 30)
    private String seccion;

    @Column(name = "carrera", length = 150)
    private String carrera;

    @Column(name = "modalidad", length = 40)
    private String modalidad;

    @Column(name = "tipo_clase", length = 80, nullable = true)
    private String tipoClase;

    @Column(name = "aforo")
    private Integer aforo;

    @Column(name = "inscritos")
    private Integer inscritos;

    @Column(name = "grado", length = 30)
    private String grado;

    @Column(name = "dia_clase", length = 30)
    private String diaClase;

    @Column(name = "hora_inicio")
    private LocalTime horaInicio;

    @Column(name = "hora_fin")
    private LocalTime horaFin;

    @Column(name = "horas_prog")
    private BigDecimal horasProg;

    @Column(name = "clase", length = 50)
    private String clase;

    @Column(name = "tiempo_traslado_min")
    private Integer tiempoTrasladoMin = 15;

    public HorarioPresencial() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCoordinadorCurso() { return coordinadorCurso; }
    public void setCoordinadorCurso(String coordinadorCurso) { this.coordinadorCurso = coordinadorCurso; }

    public String getCodDocente() { return codDocente; }
    public void setCodDocente(String codDocente) { this.codDocente = codDocente; }

    public String getNomDocente() { return nomDocente; }
    public void setNomDocente(String nomDocente) { this.nomDocente = nomDocente; }

    public String getCodCurso() { return codCurso; }
    public void setCodCurso(String codCurso) { this.codCurso = codCurso; }

    public String getCurso() { return curso; }
    public void setCurso(String curso) { this.curso = curso; }

    public String getCatalogo() { return catalogo; }
    public void setCatalogo(String catalogo) { this.catalogo = catalogo; }

    public String getCiclo() { return ciclo; }
    public void setCiclo(String ciclo) { this.ciclo = ciclo; }

    public String getSeccion() { return seccion; }
    public void setSeccion(String seccion) { this.seccion = seccion; }

    public String getCarrera() { return carrera; }
    public void setCarrera(String carrera) { this.carrera = carrera; }

    public String getModalidad() { return modalidad; }
    public void setModalidad(String modalidad) { this.modalidad = modalidad; }

    public String getTipoClase() { return tipoClase; }
    public void setTipoClase(String tipoClase) { this.tipoClase = tipoClase; }

    public Integer getAforo() { return aforo; }
    public void setAforo(Integer aforo) { this.aforo = aforo; }

    public Integer getInscritos() { return inscritos; }
    public void setInscritos(Integer inscritos) { this.inscritos = inscritos; }

    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }

    public String getDiaClase() { return diaClase; }
    public void setDiaClase(String diaClase) { this.diaClase = diaClase; }

    public LocalTime getHoraInicio() { return horaInicio; }
    public void setHoraInicio(LocalTime horaInicio) { this.horaInicio = horaInicio; }

    public LocalTime getHoraFin() { return horaFin; }
    public void setHoraFin(LocalTime horaFin) { this.horaFin = horaFin; }

    public BigDecimal getHorasProg() { return horasProg; }
    public void setHorasProg(BigDecimal horasProg) { this.horasProg = horasProg; }

    public String getClase() { return clase; }
    public void setClase(String clase) { this.clase = clase; }

    public Integer getTiempoTrasladoMin() { return tiempoTrasladoMin; }
    public void setTiempoTrasladoMin(Integer tiempoTrasladoMin) { this.tiempoTrasladoMin = tiempoTrasladoMin; }
}
