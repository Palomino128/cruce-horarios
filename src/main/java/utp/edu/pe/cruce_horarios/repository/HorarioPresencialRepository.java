package utp.edu.pe.cruce_horarios.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
    List<HorarioPresencial> findByClaseIgnoreCase(String clase);
    List<HorarioPresencial> findByClaseIgnoreCaseAndDiaClaseIgnoreCase(String clase, String diaClase);
    List<HorarioPresencial> findTop10ByOrderByIdAsc();

    @Query("SELECT COUNT(h) FROM HorarioPresencial h WHERE h.inscritos IS NOT NULL AND h.aforo IS NOT NULL AND h.inscritos > h.aforo")
    long countSobrecupo();

    @Query("SELECT h.clase, MAX(h.aforo) FROM HorarioPresencial h WHERE h.clase IS NOT NULL AND h.clase <> '' GROUP BY h.clase ORDER BY h.clase ASC")
    List<Object[]> listarAulasConAforo();

    @Query("SELECT MAX(h.aforo) FROM HorarioPresencial h WHERE UPPER(h.clase) = UPPER(:clase) AND h.aforo IS NOT NULL")
    Integer obtenerAforoMaximoDeAula(@Param("clase") String clase);

    @Query("""
            SELECT h FROM HorarioPresencial h
             WHERE (:q IS NULL OR :q = ''
                    OR LOWER(COALESCE(h.codCurso, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(h.curso, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(h.clase, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(h.carrera, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(h.seccion, '')) LIKE LOWER(CONCAT('%', :q, '%')))
               AND (:dia IS NULL OR :dia = '' OR LOWER(COALESCE(h.diaClase, '')) = LOWER(:dia))
               AND (:clase IS NULL OR :clase = '' OR UPPER(COALESCE(h.clase, '')) = UPPER(:clase))
               AND (:soloSobrecupo = false OR (h.inscritos IS NOT NULL AND h.aforo IS NOT NULL AND h.inscritos > h.aforo))
             ORDER BY h.id ASC
            """)
    Page<HorarioPresencial> buscarFiltrado(
            @Param("q") String q,
            @Param("dia") String dia,
            @Param("clase") String clase,
            @Param("soloSobrecupo") boolean soloSobrecupo,
            Pageable pageable);
}
