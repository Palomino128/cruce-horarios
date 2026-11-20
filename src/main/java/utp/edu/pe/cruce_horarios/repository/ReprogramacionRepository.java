package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;

import java.util.List;

@Repository
public interface ReprogramacionRepository extends JpaRepository<Reprogramacion, Long> {
    List<Reprogramacion> findByDocenteCodigo(String docenteCodigo);
    List<Reprogramacion> findByDocenteCodigoIgnoreCase(String docenteCodigo);
    List<Reprogramacion> findByCurso(String curso);
}
