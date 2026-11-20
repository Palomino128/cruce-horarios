package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utp.edu.pe.cruce_horarios.model.Horario;

import java.util.List;

@Repository
public interface HorarioRepository extends JpaRepository<Horario, Long> {
    List<Horario> findByDocenteCodigo(String docenteCodigo);
    List<Horario> findByDocenteCodigoIgnoreCase(String docenteCodigo);
    List<Horario> findByCurso(String curso);
}
