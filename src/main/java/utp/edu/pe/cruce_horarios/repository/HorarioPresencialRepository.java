package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utp.edu.pe.cruce_horarios.model.HorarioPresencial;

import java.util.List;

@Repository
public interface HorarioPresencialRepository extends JpaRepository<HorarioPresencial, Long> {
    List<HorarioPresencial> findByCodDocente(String codDocente);
    List<HorarioPresencial> findByCodDocenteIgnoreCase(String codDocente);
    List<HorarioPresencial> findByCurso(String curso);
    List<HorarioPresencial> findByCodCurso(String codCurso);
    List<HorarioPresencial> findByDiaClaseIgnoreCase(String diaClase);
}
