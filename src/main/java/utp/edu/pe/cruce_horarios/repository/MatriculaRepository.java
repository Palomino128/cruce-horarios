package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utp.edu.pe.cruce_horarios.model.Matricula;

import java.util.List;

@Repository
public interface MatriculaRepository extends JpaRepository<Matricula, Long> {
    List<Matricula> findByEstudianteCodigo(String estudianteCodigo);
    List<Matricula> findByEstudianteCodigoIgnoreCase(String estudianteCodigo);
    List<Matricula> findByCurso(String curso);
}
