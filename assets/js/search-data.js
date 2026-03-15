// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "I hope you will be interested 🐈‍⬛...",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "post-单车模型横向动力学误差模型mpc控制",
        
          title: "单车模型横向动力学误差模型MPC控制",
        
        description: "将车辆横向动力学误差模型近似为含扰动的 LTI 系统，设计线性 MPC 控制器，并通过增广状态空间形式将等式约束融入代价函数，得到标准 QP 便于实时求解。",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/vehicle-lat-control/";
          
        },
      },{id: "post-新的一年",
        
          title: "新的一年",
        
        description: "",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/happy-chinese-new-year/";
          
        },
      },{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/the_godfather/";
            },},{id: "news-a-simple-inline-announcement",
          title: 'A simple inline announcement.',
          description: "",
          section: "News",},{id: "news-a-long-announcement-with-details",
          title: 'A long announcement with details',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/announcement_2/";
            },},{id: "news-a-simple-inline-announcement-with-markdown-emoji-sparkles-smile",
          title: 'A simple inline announcement with Markdown emoji! :sparkles: :smile:',
          description: "",
          section: "News",},{id: "projects-newbiempc-drone",
          title: 'NewbieMPC-Drone',
          description: "QSimple quadrotor flight featuring a nonlinear MPC controller based on quadrotor dynamics.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/newbieMPC-Drone/";
            },},{id: "projects-polys-mapgen",
          title: 'polys_mapgen',
          description: "ROS package that generates a 3D point cloud map from convex polytopes (H-rep) and publishes as PointCloud2 for planners.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/polys_mapgen/";
            },},{id: "projects-sfc-planner",
          title: 'sfc_planner',
          description: "Planner based on Safe Flight Corridors (SFCs) for UAV global planning and navigation, with target-direction inflation example.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/sfc_planner/";
            },},{id: "teachings-data-science-fundamentals",
          title: 'Data Science Fundamentals',
          description: "This course covers the foundational aspects of data science, including data collection, cleaning, analysis, and visualization. Students will learn practical skills for working with real-world datasets.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/data-science-fundamentals/";
            },},{id: "teachings-introduction-to-machine-learning",
          title: 'Introduction to Machine Learning',
          description: "This course provides an introduction to machine learning concepts, algorithms, and applications. Students will learn about supervised and unsupervised learning, model evaluation, and practical implementations.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/introduction-to-machine-learning/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/example_pdf.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%6A%74%6F%64%6F%67@%6F%75%74%6C%6F%6F%6B.%63%6F%6D", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
