package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utp.edu.pe.cruce_horarios.model.Docente;

import java.util.Optional;

@Repository
public interface DocenteRepository extends JpaRepository<Docente, Long> {
    Optional<Docente> findByCodigo(String codigo);
    Optional<Docente> findByCodigoIgnoreCase(String codigo);
}
