import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Badge, Button, Card, Accordion } from 'react-bootstrap';
import { BsCheckCircleFill, BsPlayCircle, BsChevronRight, BsClock, BsPersonVideo, BsFileText, BsAward, BsGlobe, BsPlayCircleFill, BsPencilSquare, BsHourglassSplit, BsExclamationCircle, BsPerson, BsCameraVideo, BsImage } from 'react-icons/bs';
import { useDispatch, useSelector } from 'react-redux';
import { showSubtleLoader, hideSubtleLoader, addAlert, showAppLoader, hideAppLoader } from '../redux/slices/uiSlice';
import supabase from '../utils/supabase';
import usePaystack from '../hooks/usePaystack';
import { PAYSTACK_CONFIG } from '../utils/paystack';

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');
  const [enrollment, setEnrollment] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [pendingEnrollment, setPendingEnrollment] = useState(null);

  // Paystack Configuration
  const paystackConfig = {
    reference: pendingEnrollment ? `FHHF_ENR_${pendingEnrollment.id}_${new Date().getTime()}` : '',
    email: user?.email,
    amount: Math.round((Number(course?.price) || 0) * 100),
    publicKey: PAYSTACK_CONFIG.PUBLIC_KEY,
    currency: 'NGN',
    metadata: {
      transaction_type: 'fhhf_course',
      enrollment_id: pendingEnrollment?.id,
      course_id: course?.id
    }
  };

  const initializePayment = usePaystack(paystackConfig);

  useEffect(() => {
    if (pendingEnrollment) {
      initializePayment({
        onSuccess: (response) => {
          console.log("Course Payment Success:", response);
          dispatch(addAlert({ variant: 'success', message: 'Payment successful! Welcome to the course.' }));
          navigate(`/courses/player/${course.id}`);
        },
        onClose: () => {
          setEnrolling(false);
          setPendingEnrollment(null);
          dispatch(addAlert({ variant: 'warning', message: 'Payment window closed. You can complete your enrollment later by clicking Enroll again.' }));
        }
      });
    }
  }, [pendingEnrollment, initializePayment, navigate, dispatch, course?.id]);

  useEffect(() => {
    // Dummy courses shouldn't be accessible directly
    if (courseId?.startsWith('dummy-')) {
      navigate('/courses');
      return;
    }
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    dispatch(showSubtleLoader('Loading course...'));
    try {
      const { data, error } = await supabase
        .from('fhhf_courses')
        .select(`
          *,
          instructor:fhhf_user_profiles!instructor_id(id, username, profile_img, instructor_position_title, instructor_bio),
          modules:fhhf_course_modules(
            *,
            lessons:fhhf_course_lessons(*)
          )
        `)
        .eq('id', courseId)
        .single();

      if (error) throw error;

      // Sort modules and lessons correctly
      if (data.modules) {
        data.modules.sort((a, b) => a.order_index - b.order_index);
        data.modules.forEach(m => {
          if (m.lessons) m.lessons.sort((a, b) => a.order_index - b.order_index);
        });
      }

      setCourse(data);

      // If user is logged in, check their enrollment status
      if (user?.id) {
        const { data: enrollData } = await supabase
          .from('fhhf_user_enrollments')
          .select('*')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .single();

        if (enrollData) {
          setEnrollment(enrollData);
        }
      }

    } catch (err) {
      console.error(err);
      navigate('/courses');
    } finally {
      setLoading(false);
      dispatch(hideSubtleLoader());
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      dispatch(addAlert({ variant: 'warning', message: 'Please log in to enroll in this course.' }));
      navigate('/login', { state: { from: `/course/${courseId}` } });
      return;
    }

    try {      // Check if user is already enrolled with has_paid = true
      if (enrollment?.has_paid) {
        navigate(`/courses/player/${course.id}`);
        return;
      }

      setEnrolling(true);
      dispatch(showAppLoader('Processing your enrollment...'));

      const { data: enrollmentId, error } = await supabase.rpc('fhhf_enroll_in_course', {
        p_course_id: course.id
      });

      if (error) throw error;

      if (course.is_free) {
        dispatch(hideAppLoader());
        dispatch(addAlert({ variant: 'success', message: 'Successfully enrolled! Redirecting to course player...' }));
        navigate(`/courses/player/${course.id}`);
      } else {
        // It's a paid course. The RPC returned an enrollment ID with has_paid = false.
        // We set the pendingEnrollment state, which triggers the useEffect to launch Paystack.
        dispatch(hideAppLoader());
        setPendingEnrollment({ id: enrollmentId });
      }

    } catch (err) {
      console.error('Enrollment error:', err);
      if (err.message?.includes('Instructors cannot enroll')) {
        dispatch(addAlert({ variant: 'warning', message: 'Instructors cannot enroll in their own courses.' }));
      } else {
        dispatch(addAlert({ variant: 'danger', message: 'Failed to enroll. Please try again.' }));
      }
      setEnrolling(false);
      dispatch(hideAppLoader());
    }
  };

  if (loading) return null;

  if (!course) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <p className="text-muted">Course not found.</p>
      </Container>
    );
  }

  const isPublished = course.status === 'published';

  // Aggregate all unique contributors from modules
  const allContributors = [];
  if (course.modules) {
    course.modules.forEach(module => {
      if (module.contributors && module.contributors.length > 0) {
        module.contributors.forEach(contrib => {
          const existing = allContributors.find(c => c.name === contrib.name && c.role === contrib.role);
          if (existing) {
            existing.modules.push(module.title);
          } else {
            allContributors.push({
              ...contrib,
              modules: [module.title]
            });
          }
        });
      }
    });
  }

  if (!isPublished) {
    return (
      <div className="bg-light pb-5" style={{ minHeight: '100vh', paddingTop: '100px' }}>
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
          <Card className="text-center p-5 border-0 shadow-sm rounded-4 w-100" style={{ maxWidth: '600px' }}>
            <div className="mb-4">
              {course.status === 'draft' ? (
                <div className="d-inline-flex p-4 rounded-circle bg-warning bg-opacity-10 mb-2">
                  <BsPencilSquare size={50} className="text-warning" />
                </div>
              ) : course.status === 'pending_approval' ? (
                <div className="d-inline-flex p-4 rounded-circle bg-primary bg-opacity-10 mb-2">
                  <BsHourglassSplit size={50} className="text-primary" />
                </div>
              ) : (
                <div className="d-inline-flex p-4 rounded-circle bg-danger bg-opacity-10 mb-2">
                  <BsExclamationCircle size={50} className="text-danger" />
                </div>
              )}
            </div>
            <h2 className="fw-bold mb-3" style={{ fontFamily: 'var(--font-family-heading)' }}>
              {course.status === 'draft' ? 'Course Under Construction' : course.status === 'pending_approval' ? 'Awaiting Approval' : 'Course Unavailable'}
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '1.1rem' }}>
              {course.status === 'draft'
                ? 'This course is currently being edited by the instructor and is not yet available to the public.'
                : course.status === 'pending_approval'
                  ? 'This course has been submitted and is currently under review by our moderation team.'
                  : 'This course has been removed or is currently unavailable.'}
            </p>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="course-details-page bg-light pb-5" style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      {/* Cinematic Hero */}
      <div className="position-relative text-white" style={{ minHeight: '60vh', padding: '120px 0 80px 0', backgroundColor: '#0a0a0a' }}>
        {course.thumbnail_image && (
          <div
            className="position-absolute w-100 h-100 top-0 start-0 z-0"
            style={{
              backgroundImage: `url(${course.thumbnail_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px) brightness(0.2)'
            }}
          />
        )}
        <div className="position-absolute w-100 h-100 top-0 start-0 z-1" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(10,10,10,1) 100%)' }} />

        <Container className="position-relative z-2 h-100">
          <Row>
            <Col lg={8}>
              <div className="d-flex align-items-center gap-2 mb-4 text-white-50 small fw-bold text-uppercase tracking-widest">
                <Link to="/courses" className="text-white-50 text-decoration-none hover-white">Learning Hub</Link>
                <BsChevronRight size={10} />
                <span>{course.category || 'Uncategorized'}</span>
              </div>

              <h1 className="display-4 fw-bold mb-4 text-light" style={{ fontFamily: 'var(--font-family-heading)' }}>
                {course.title}
              </h1>

              {course.description && (
                <div
                  className="lead text-white-50 mb-4 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />
              )}

              <div className="d-flex align-items-center gap-4 mb-5">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle overflow-hidden bg-secondary d-flex justify-content-center align-items-center" style={{ width: '40px', height: '40px', border: '2px solid rgba(255,255,255,0.2)' }}>
                    {course.instructor?.profile_img ? (
                      <img src={course.instructor.profile_img} alt="Instructor" className="w-100 h-100 object-fit-cover" />
                    ) : (
                      <span className="fw-bold text-primary">{course.instructor?.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div>
                    <div className="small text-white-50">Instructor</div>
                    <div className="fw-bold">{course.instructor?.username || 'FHHF Expert'}</div>
                  </div>
                </div>

                <div className="border-start border-secondary opacity-50 h-100 mx-1"></div>

                <div>
                  <div className="small text-white-50">Last Updated</div>
                  <div className="fw-bold">{new Date(course.updated_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-3">
                <Badge bg="light" text="dark" className="px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                  <BsGlobe /> English
                </Badge>
                <Badge bg="dark" border="secondary" className="px-3 py-2 rounded-pill border d-flex align-items-center gap-2">
                  <BsAward /> Certificate of Completion
                </Badge>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="position-relative">
        <Row>
          {/* Main Content */}
          <Col lg={8} className="py-5 pe-lg-5">
            {/* Mobile Media Preview (Only visible on screens smaller than lg) */}
            <div className="d-lg-none mb-5 rounded-4 overflow-hidden shadow-sm bg-dark" style={{ height: '240px' }}>
              {course.thumbnail_url ? (
                <video
                  src={course.thumbnail_url}
                  className="w-100 h-100 object-fit-contain"
                  controls
                  controlsList="nodownload"
                />
              ) : course.thumbnail_image ? (
                <img src={course.thumbnail_image} className="w-100 h-100 object-fit-cover" alt="Course Preview" />
              ) : (
                <div className="w-100 h-100 bg-dark d-flex align-items-center justify-content-center">
                  <BsPlayCircleFill size={50} className="text-white opacity-50" />
                </div>
              )}
            </div>

            {/* Sticky Nav */}
            <div className="sticky-top bg-light py-3 mb-5 z-3 d-flex gap-4 border-bottom" style={{ top: '70px' }}>
              <button
                className={`btn btn-link text-decoration-none fw-bold p-0 ${activeTab === 'about' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                onClick={() => setActiveTab('about')}
              >
                About
              </button>
              <button
                className={`btn btn-link text-decoration-none fw-bold p-0 ${activeTab === 'curriculum' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                onClick={() => setActiveTab('curriculum')}
              >
                Curriculum
              </button>
              <button
                className={`btn btn-link text-decoration-none fw-bold p-0 ${activeTab === 'instructor' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                onClick={() => setActiveTab('instructor')}
              >
                Instructor
              </button>
            </div>

            {activeTab === 'about' && (
              <div className="animate-fade-in">
                <h4 className="fw-bold mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>About This Course</h4>
                <div
                  className="text-secondary lh-lg mb-5 content-rich"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />

                <h4 className="fw-bold mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>What You'll Learn</h4>
                {course.what_you_will_learn && course.what_you_will_learn.length > 0 ? (
                  <Row className="g-3 mb-5">
                    {course.what_you_will_learn.map((item, i) => (
                      <Col md={6} key={i}>
                        <div className="d-flex align-items-start gap-3">
                          <BsCheckCircleFill className="text-primary mt-1 flex-shrink-0" />
                          <span className="text-dark fw-medium">{item}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <p className="text-muted mb-5">Learning outcomes not specified.</p>
                )}
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="animate-fade-in">
                <h4 className="fw-bold mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>Course Curriculum</h4>
                <p className="text-muted mb-4">{course.modules?.length || 0} sections • {course.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)} total lessons</p>

                <Accordion defaultActiveKey="0" className="custom-accordion shadow-sm rounded-4 overflow-hidden border-0">
                  {course.modules?.map((module, idx) => (
                    <Accordion.Item eventKey={idx.toString()} key={module.id} className="border-0 border-bottom">
                      <Accordion.Header className="bg-white p-3">
                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                          <span className="fw-bold text-dark">{module.title}</span>
                          <span className="small text-muted">{module.lessons?.length || 0} lessons</span>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body className="p-0 bg-light">
                        {/* Module Enhancements: Contributors & Preview Media */}
                        {(module.contributors?.length > 0 || (module.preview_media && (module.preview_media.video_url || module.preview_media.images?.length > 0))) && (
                          <div className="bg-white border-bottom p-4">
                            <div className="row g-4">
                              {/* Contributors */}
                              {module.contributors?.length > 0 && (
                                <div className="col-md-6 border-md-end pe-md-4">
                                  <div className="d-flex align-items-center mb-3">
                                    <BsPerson className="text-primary me-2" size={18} />
                                    <strong className="text-dark small text-uppercase tracking-widest">Instructors / Contributors</strong>
                                  </div>
                                  <div className="d-flex flex-column gap-3">
                                    {module.contributors.map((contrib, cIdx) => (
                                      <div key={cIdx} className="d-flex align-items-start gap-3">
                                        {contrib.profile_image_url ? (
                                          <img src={contrib.profile_image_url} alt={contrib.name} className="rounded-circle shadow-sm" style={{ width: 40, height: 40, objectFit: 'cover' }} />
                                        ) : (
                                          <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm" style={{ width: 40, height: 40, fontSize: '16px' }}>
                                            {contrib.name.charAt(0)}
                                          </div>
                                        )}
                                        <div>
                                          <div className="fw-bold text-dark">{contrib.name} <Badge bg="light" text="dark" className="border fw-normal ms-1" style={{ fontSize: '11px' }}>{contrib.role}</Badge></div>
                                          {contrib.description && <div className="text-muted small mt-1 lh-sm">{contrib.description}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Preview Media */}
                              {(module.preview_media?.video_url || module.preview_media?.images?.length > 0) && (
                                <div className="col-md-6 ps-md-4">
                                  <div className="d-flex align-items-center mb-3">
                                    {module.preview_media.video_url ? <BsCameraVideo className="text-danger me-2" size={18} /> : <BsImage className="text-success me-2" size={18} />}
                                    <strong className="text-dark small text-uppercase tracking-widest">Module Outcomes</strong>
                                  </div>
                                  {module.preview_media.video_url ? (
                                    <div className="ratio ratio-16x9 rounded-3 overflow-hidden shadow-sm bg-dark">
                                      <video controls controlsList="nodownload">
                                        <source src={module.preview_media.video_url} />
                                        Your browser does not support HTML video.
                                      </video>
                                    </div>
                                  ) : (
                                    <div className="d-flex flex-wrap gap-2">
                                      {module.preview_media.images?.map((img, iIdx) => (
                                        <a href={img} target="_blank" rel="noreferrer" key={iIdx} className="d-block overflow-hidden rounded-3 shadow-sm" style={{ width: '80px', height: '80px' }}>
                                          <img src={img} alt="Preview" className="w-100 h-100 object-fit-cover hover-scale transition-all" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {module.lessons?.length > 0 ? (
                          <div className="list-group list-group-flush">
                            {module.lessons.map(lesson => (
                              <div key={lesson.id} className="list-group-item bg-transparent px-4 py-3 d-flex justify-content-between align-items-center border-bottom-0 border-top" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                                <div className="d-flex align-items-center gap-3">
                                  <BsPlayCircle className={lesson.is_free_preview ? "text-primary" : "text-muted opacity-50"} size={18} />
                                  <span className={lesson.is_free_preview ? "text-dark fw-medium" : "text-secondary"}>{lesson.title}</span>
                                </div>
                                {lesson.is_free_preview && (
                                  <Badge bg="none" className="text-primary rounded-pill bg-opacity-10 border border-primary border-opacity-25" style={{ backgroundColor: 'rgba(13, 110, 253, 0.1)' }}>Preview</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-muted small">No lessons uploaded yet.</div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
                {(!course.modules || course.modules.length === 0) && (
                  <div className="p-5 text-center bg-white rounded-4 shadow-sm">
                    <p className="text-muted m-0">Curriculum is currently being updated.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructor' && (
              <div className="animate-fade-in mb-5">
                <h4 className="fw-bold mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>Your Instructor</h4>
                <Card className="border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                  <div className="d-flex flex-column flex-md-row gap-4 align-items-md-center">
                    <div className="rounded-circle overflow-hidden bg-light border shadow-sm flex-shrink-0" style={{ width: '120px', height: '120px' }}>
                      {course.instructor?.profile_img ? (
                        <img src={course.instructor.profile_img} alt="Instructor" className="w-100 h-100 object-fit-cover" />
                      ) : (
                        <div className="w-100 h-100 d-flex justify-content-center align-items-center bg-primary text-white display-4 fw-bold">
                          {course.instructor?.username?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="fw-bold mb-1 text-dark">{course.instructor?.username || 'FHHF Expert'}</h3>
                      <p className="text-primary fw-medium mb-3">{course.instructor?.instructor_position_title || 'Expert Instructor'}</p>
                      <p className="text-secondary mb-0">
                        {course.instructor?.instructor_bio || 'An experienced professional dedicated to bringing world-class education to the forefront. With years of hands-on industry experience, they bridge the gap between theory and real-world application.'}
                      </p>
                    </div>
                  </div>
                </Card>

                {allContributors.length > 0 && (
                  <div className="mt-5">
                    <h4 className="fw-bold mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>Module Contributors</h4>
                    <Row className="g-4">
                      {allContributors.map((contrib, idx) => (
                        <Col md={6} key={idx}>
                          <Card className="border-0 shadow-sm rounded-4 p-4 bg-white h-100 d-flex flex-column hover-scale transition-all">
                            <div className="d-flex align-items-center gap-3 mb-3">
                              {contrib.profile_image_url ? (
                                <img src={contrib.profile_image_url} alt={contrib.name} className="rounded-circle shadow-sm flex-shrink-0" style={{ width: 60, height: 60, objectFit: 'cover' }} />
                              ) : (
                                <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0" style={{ width: 60, height: 60, fontSize: '24px' }}>
                                  {contrib.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <h6 className="fw-bold text-dark mb-1">{contrib.name}</h6>
                                <Badge bg="light" text="dark" className="border fw-normal">{contrib.role}</Badge>
                              </div>
                            </div>
                            {contrib.description && <p className="text-muted small mb-3 flex-grow-1">{contrib.description}</p>}
                            <div className="mt-auto pt-3 border-top">
                              <div className="small text-muted fw-bold mb-2 tracking-widest text-uppercase" style={{ fontSize: '10px' }}>Contributed to</div>
                              <div className="d-flex flex-wrap gap-2">
                                {contrib.modules.map((modTitle, mIdx) => (
                                  <Badge bg="none" className="text-primary rounded-pill border border-primary border-opacity-25 fw-normal text-truncate" style={{ backgroundColor: 'rgba(13, 110, 253, 0.1)', maxWidth: '100%' }} key={mIdx}>{modTitle}</Badge>
                                ))}
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )}
              </div>
            )}

          </Col>

          {/* Floating Enrollment Card */}
          <Col lg={4} className="d-none d-lg-block">
            <div className="position-sticky z-3" style={{ top: '100px', marginTop: '-250px' }}>
              <Card className="border-0 shadow-lg rounded-4 overflow-hidden bg-white">
                <div className="position-relative bg-dark" style={{ height: '220px' }}>
                  {course.thumbnail_url ? (
                    <video
                      src={course.thumbnail_url}
                      className="w-100 h-100 object-fit-contain"
                      controls
                      controlsList="nodownload"
                    />
                  ) : course.thumbnail_image ? (
                    <img src={course.thumbnail_image} className="w-100 h-100 object-fit-cover" alt="Course Preview" />
                  ) : (
                    <div className="w-100 h-100 bg-dark d-flex align-items-center justify-content-center">
                      <BsPlayCircleFill size={50} className="text-white opacity-50" />
                    </div>
                  )}
                </div>

                <Card.Body className="p-4 p-xl-5">
                  <h2 className="fw-bold mb-4 text-dark" style={{ fontFamily: 'var(--font-family-heading)' }}>
                    {course.is_free ? 'Free' : `₦${course.price?.toLocaleString()}`}
                  </h2>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-100 rounded-pill fw-bold py-3 mb-3 shadow-sm hover-scale"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll Now'}
                  </Button>
                  <div className="text-center small text-muted mb-4">Full Lifetime Access</div>

                  <h6 className="fw-bold mb-3 text-dark">This course includes:</h6>
                  <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
                    <li className="d-flex align-items-center gap-3 text-secondary">
                      <BsPersonVideo className="text-primary fs-5" />
                      <span>On-demand premium video or text or audio content</span>
                    </li>
                    <li className="d-flex align-items-center gap-3 text-secondary">
                      <BsClock className="text-primary fs-5" />
                      <span>Learn at your own pace</span>
                    </li>
                    <li className="d-flex align-items-center gap-3 text-secondary">
                      <BsAward className="text-primary fs-5" />
                      <span>Certificate of completion</span>
                    </li>
                  </ul>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>

      {/* Mobile Sticky Enrollment Bar */}
      <div className="d-lg-none position-fixed bottom-0 start-0 w-100 bg-white border-top shadow-lg p-3 z-3 d-flex justify-content-between align-items-center pb-safe">
        <div>
          <div className="small text-muted fw-bold">Price</div>
          <div className="fw-bold text-dark fs-5">{course.is_free ? 'Free' : `₦${course.price?.toLocaleString()}`}</div>
        </div>
        <Button
          variant="primary"
          className="rounded-pill px-5 fw-bold py-2 shadow-sm"
          onClick={handleEnroll}
          disabled={enrolling}
        >
          {enrolling ? 'Enrolling...' : 'Enroll Now'}
        </Button>
      </div>
    </div>
  );
}
